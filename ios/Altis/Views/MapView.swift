import MapKit
import SwiftUI

struct MapView: View {
    @EnvironmentObject private var settings: ForecastSettings
    private let scenario: Scenario = .base
    @State private var companies: [Company] = []
    @State private var weeksByCompany: [Int: [ForecastWeek]] = [:]
    @State private var weatherByLocation: [Int: [WeatherWeek]] = [:]
    @State private var selectedCompanyId: Int?
    @State private var weekIndex: Double = 0
    @State private var loading = false
    @State private var error: String?
    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 52.25, longitude: 5.55),
            span: MKCoordinateSpan(latitudeDelta: 3.15, longitudeDelta: 4.4)
        )
    )

    private var markers: [CompanyMapMarker] {
        companies.compactMap { company in
            guard let latitude = company.latitude, let longitude = company.longitude else { return nil }
            let adjusted = ForecastEngine.adjust(weeksByCompany[company.id] ?? [], settings: settings)
            let weather = (company.weatherLocationId.flatMap { weatherByLocation[$0] } ?? [])
                .filter(\.isForecastFlag)
                .sorted { $0.weekStart < $1.weekStart }
            return CompanyMapMarker(
                company: company,
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                weeks: adjusted.weeks,
                weather: Array(weather.prefix(settings.horizonWeeks)),
                rule: settings.weatherRule
            )
        }
        .sorted {
            if $0.overallRisk.severity != $1.overallRisk.severity {
                return $0.overallRisk.severity > $1.overallRisk.severity
            }
            return $0.deferredCashImpact > $1.deferredCashImpact
        }
    }

    private var selectedMarker: CompanyMapMarker? {
        markers.first { $0.id == selectedCompanyId } ?? markers.first
    }

    /// Number of scrubbable weeks = the selected company's weather timeline.
    private var timelineCount: Int { max(1, selectedMarker?.weather.count ?? 1) }
    private var clampedIndex: Int { min(max(0, Int(weekIndex)), timelineCount - 1) }

    var body: some View {
        NavigationStack {
            Group {
                if let error, companies.isEmpty {
                    ErrorState(message: error) { Task { await load() } }
                } else if loading && companies.isEmpty {
                    ProgressView("Loading map...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    content
                }
            }
            .navigationTitle("Map")
        }
        .task { await load() }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                mapCard
                scrubberCard
                if let selectedMarker {
                    WeatherTimeline(marker: selectedMarker, selected: clampedIndex) { idx in
                        weekIndex = Double(idx)
                    }
                    MapMarkerDetail(marker: selectedMarker, weekIndex: clampedIndex)
                }
                companiesCard
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .refreshable { await load(forceCompanies: true) }
    }

    private var mapCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Location weather risk")
                .font(.headline)
            Text("Markers recolor as you scrub the week below. Risk combines local weather (\(settings.weatherRule.label)) and forecast cash risk.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Map(position: $position) {
                ForEach(markers) { marker in
                    Annotation(marker.company.displayName, coordinate: marker.coordinate) {
                        Button { selectedCompanyId = marker.id } label: {
                            MapRiskMarker(
                                marker: marker,
                                risk: marker.combinedRisk(at: clampedIndex),
                                selected: marker.id == selectedMarker?.id
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(marker.company.displayName), \(marker.combinedRisk(at: clampedIndex).label) risk")
                    }
                }
            }
            .mapStyle(.standard(elevation: .flat))
            .frame(height: 320)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private var scrubberCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Week", systemImage: "calendar")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(selectedWeekLabel)
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            if timelineCount > 1 {
                Slider(value: $weekIndex, in: 0...Double(timelineCount - 1), step: 1)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private var selectedWeekLabel: String {
        guard let marker = selectedMarker, marker.weather.indices.contains(clampedIndex) else { return "—" }
        let wk = marker.weather[clampedIndex]
        return "Week of \(Format.dateLong(wk.weekStart))"
    }

    private var companiesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Companies")
                .font(.headline)
            ForEach(markers) { marker in
                Button {
                    selectedCompanyId = marker.id
                    position = .region(MKCoordinateRegion(
                        center: marker.coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.7, longitudeDelta: 0.9)
                    ))
                } label: {
                    MapCompanyRow(marker: marker, weekIndex: clampedIndex)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func load(forceCompanies: Bool = false) async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let service = SupabaseService.shared
            if companies.isEmpty || forceCompanies {
                companies = try await service.companies()
                selectedCompanyId = selectedCompanyId ?? companies.first(where: \.hasCoordinate)?.id
            }

            var forecastMap: [Int: [ForecastWeek]] = [:]
            try await withThrowingTaskGroup(of: (Int, [ForecastWeek]).self) { group in
                for company in companies {
                    group.addTask {
                        (company.id, try await service.companyWeeks(companyId: company.id, scenario: scenario))
                    }
                }
                for try await (id, weeks) in group { forecastMap[id] = weeks }
            }
            weeksByCompany = forecastMap

            let locationIds = Set(companies.compactMap(\.weatherLocationId))
            var weatherMap: [Int: [WeatherWeek]] = [:]
            try await withThrowingTaskGroup(of: (Int, [WeatherWeek]).self) { group in
                for locationId in locationIds {
                    group.addTask { (locationId, try await service.weather(locationId: locationId)) }
                }
                for try await (id, weeks) in group { weatherMap[id] = weeks }
            }
            weatherByLocation = weatherMap
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Marker model

private struct CompanyMapMarker: Identifiable {
    let company: Company
    let coordinate: CLLocationCoordinate2D
    let weeks: [ForecastWeek]      // settings-adjusted forecast
    let weather: [WeatherWeek]     // forecast weather, ascending
    let rule: WeatherRule

    var id: Int { company.id }

    func weatherRisk(at index: Int) -> RiskLevel {
        guard weather.indices.contains(index) else { return .low }
        return rule.risk(for: weather[index])
    }
    func cashRisk(at index: Int) -> RiskLevel {
        guard weeks.indices.contains(index) else { return .low }
        return weeks[index].risk
    }
    func combinedRisk(at index: Int) -> RiskLevel {
        let w = weatherRisk(at: index), c = cashRisk(at: index)
        return w.severity >= c.severity ? w : c
    }
    func rainWorkdays(at index: Int) -> Int {
        weather.indices.contains(index) ? rule.value(for: weather[index]) : 0
    }

    var overallRisk: RiskLevel {
        let w = weather.map { rule.risk(for: $0) }.max(by: { $0.severity < $1.severity }) ?? .low
        let c = weeks.map(\.risk).max(by: { $0.severity < $1.severity }) ?? .low
        return w.severity >= c.severity ? w : c
    }
    var deferredCashImpact: Double { weeks.reduce(0) { $0 + max(0, -$1.weatherAdjustment) } }
    var totalWeatherImpact: Double { weeks.reduce(0) { $0 + $1.weatherAdjustment } }
    var minClosingCash: Double { weeks.map(\.closingCash).min() ?? 0 }
    var liveWeatherWeeks: Int { weeks.filter(\.isLive).count }
    var highWeatherWeeks: Int { weather.filter { rule.risk(for: $0) == .high }.count }
    var mediumWeatherWeeks: Int { weather.filter { rule.risk(for: $0) == .medium }.count }
}

// MARK: - Subviews

private struct MapRiskMarker: View {
    let marker: CompanyMapMarker
    let risk: RiskLevel
    let selected: Bool

    var body: some View {
        Text(String(marker.company.displayName.prefix(1)))
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
            .frame(width: selected ? 38 : 32, height: selected ? 38 : 32)
            .background(risk.color, in: Circle())
            .overlay(Circle().stroke(.white, lineWidth: 3))
            .shadow(color: risk.color.opacity(0.35), radius: 6, x: 0, y: 3)
    }
}

/// Horizontally scrollable weather timeline for one company. Tap a cell to scrub.
private struct WeatherTimeline: View {
    let marker: CompanyMapMarker
    let selected: Int
    let onSelect: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Weather timeline · \(marker.company.displayName)")
                .font(.subheadline.weight(.semibold))
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(marker.weather.enumerated()), id: \.offset) { idx, wk in
                            cell(idx: idx, week: wk)
                                .id(idx)
                                .onTapGesture { onSelect(idx) }
                        }
                    }
                    .padding(.vertical, 2)
                }
                .onChange(of: selected) { _, new in
                    withAnimation { proxy.scrollTo(new, anchor: .center) }
                }
            }
            if marker.weather.isEmpty {
                Text("No forecast weather for this location.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func cell(idx: Int, week: WeatherWeek) -> some View {
        let risk = marker.rule.risk(for: week)
        let isSel = idx == selected
        return VStack(spacing: 5) {
            Text(Format.weekShort(week.weekStart))
                .font(.caption2.weight(.medium))
                .foregroundStyle(isSel ? .white : .secondary)
            Image(systemName: marker.rule.value(for: week) > 0 ? "cloud.rain.fill" : "sun.max.fill")
                .font(.callout)
                .foregroundStyle(isSel ? .white : risk.color)
            Text("\(marker.rule.value(for: week))")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(isSel ? .white : .primary)
            Text("delay \(Format.score(week.delayScore))")
                .font(.system(size: 9))
                .foregroundStyle(isSel ? Color.white.opacity(0.85) : Color(.tertiaryLabel))
        }
        .frame(width: 60)
        .padding(.vertical, 10)
        .background(isSel ? risk.color : risk.color.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(risk.color.opacity(isSel ? 0 : 0.4), lineWidth: 1))
    }
}

private struct MapMarkerDetail: View {
    let marker: CompanyMapMarker
    let weekIndex: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(marker.company.displayName).font(.headline)
                    Text(marker.company.locationName ?? "No location")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                RiskBadge(risk: marker.combinedRisk(at: weekIndex))
            }

            if marker.weather.indices.contains(weekIndex) {
                let wk = marker.weather[weekIndex]
                HStack(spacing: 10) {
                    weatherStat(systemImage: "cloud.rain", value: "\(marker.rainWorkdays(at: weekIndex))", label: marker.rule.unitLabel)
                    weatherStat(systemImage: "drop", value: rainMM(wk), label: "rain")
                    weatherStat(systemImage: "clock.badge.exclamationmark", value: Format.score(wk.delayScore), label: "delay")
                }
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                KpiCard(title: "Deferred", value: Format.eurCompact(marker.deferredCashImpact), subtitle: "weather timing", systemImage: "cloud.rain", tint: marker.deferredCashImpact > 0 ? .orange : .green)
                KpiCard(title: "Weather impact", value: Format.signedEur(marker.totalWeatherImpact), subtitle: "\(marker.liveWeatherWeeks) live weeks", systemImage: "arrow.left.arrow.right", tint: marker.totalWeatherImpact < 0 ? .red : .accentColor)
                KpiCard(title: "Min closing", value: Format.eurCompact(marker.minClosingCash), subtitle: "horizon low", systemImage: "banknote", tint: marker.minClosingCash < 0 ? .red : .accentColor)
                KpiCard(title: "Weather risk", value: marker.overallRisk.label, subtitle: "\(marker.highWeatherWeeks) high, \(marker.mediumWeatherWeeks) medium", systemImage: "thermometer.sun", tint: marker.overallRisk.color)
            }

            if marker.company.usesProxyLocation {
                Label("Dataset-level weather proxy, not a project coordinate", systemImage: "mappin.and.ellipse")
                    .font(.caption).foregroundStyle(.orange)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func rainMM(_ wk: WeatherWeek) -> String {
        guard let mm = wk.rainSum else { return "–" }
        return "\(Format.score(mm))mm"
    }

    private func weatherStat(systemImage: String, value: String, label: String) -> some View {
        VStack(spacing: 3) {
            Image(systemName: systemImage).font(.callout).foregroundStyle(.secondary)
            Text(value).font(.subheadline.weight(.semibold).monospacedDigit())
            Text(label).font(.caption2).foregroundStyle(.tertiary).lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(.tertiarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct MapCompanyRow: View {
    let marker: CompanyMapMarker
    let weekIndex: Int

    var body: some View {
        HStack(spacing: 12) {
            RiskDot(risk: marker.combinedRisk(at: weekIndex))
            VStack(alignment: .leading, spacing: 2) {
                Text(marker.company.displayName)
                    .font(.subheadline.weight(.semibold))
                Text(marker.company.locationName ?? "No location")
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(marker.rainWorkdays(at: weekIndex))")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(marker.combinedRisk(at: weekIndex).color)
                Text("this wk").font(.caption2).foregroundStyle(.tertiary)
            }
            RiskBadge(risk: marker.combinedRisk(at: weekIndex), compact: true)
        }
        .padding(.vertical, 8)
    }
}
