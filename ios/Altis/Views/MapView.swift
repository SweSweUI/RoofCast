import MapKit
import SwiftUI

struct MapView: View {
    private let scenario: Scenario = .base
    @State private var companies: [Company] = []
    @State private var weeksByCompany: [Int: [ForecastWeek]] = [:]
    @State private var weatherByLocation: [Int: [WeatherWeek]] = [:]
    @State private var selectedCompanyId: Int?
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
            guard let latitude = company.latitude,
                  let longitude = company.longitude
            else { return nil }
            let weeks = weeksByCompany[company.id] ?? []
            let weather = company.weatherLocationId.flatMap { weatherByLocation[$0] } ?? []
            return CompanyMapMarker(
                company: company,
                coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                weeks: weeks,
                weather: Array(weather.prefix(13))
            )
        }
        .sorted {
            if $0.combinedRisk.severity != $1.combinedRisk.severity {
                return $0.combinedRisk.severity > $1.combinedRisk.severity
            }
            return $0.deferredCashImpact > $1.deferredCashImpact
        }
    }

    private var selectedMarker: CompanyMapMarker? {
        markers.first { $0.id == selectedCompanyId } ?? markers.first
    }

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
                VStack(alignment: .leading, spacing: 10) {
                    Text("Location weather risk")
                        .font(.headline)
                    Text("Markers combine forecast cash risk and local weather-delay risk. Proxy locations are labelled.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Map(position: $position) {
                        ForEach(markers) { marker in
                            Annotation(marker.company.displayName, coordinate: marker.coordinate) {
                                Button {
                                    selectedCompanyId = marker.id
                                } label: {
                                    MapRiskMarker(marker: marker, selected: marker.id == selectedMarker?.id)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("\(marker.company.displayName), \(marker.combinedRisk.label) risk")
                            }
                        }
                    }
                    .mapStyle(.standard(elevation: .flat))
                    .frame(height: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding(14)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))

                if let selectedMarker {
                    MapMarkerDetail(marker: selectedMarker)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Companies")
                        .font(.headline)
                    ForEach(markers) { marker in
                        Button {
                            selectedCompanyId = marker.id
                            position = .region(
                                MKCoordinateRegion(
                                    center: marker.coordinate,
                                    span: MKCoordinateSpan(latitudeDelta: 0.7, longitudeDelta: 0.9)
                                )
                            )
                        } label: {
                            MapCompanyRow(marker: marker)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(14)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .refreshable { await load(forceCompanies: true) }
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
                for try await (id, weeks) in group {
                    forecastMap[id] = weeks
                }
            }
            weeksByCompany = forecastMap

            let locationIds = Set(companies.compactMap(\.weatherLocationId))
            var weatherMap: [Int: [WeatherWeek]] = [:]
            try await withThrowingTaskGroup(of: (Int, [WeatherWeek]).self) { group in
                for locationId in locationIds {
                    group.addTask {
                        (locationId, try await service.weather(locationId: locationId))
                    }
                }
                for try await (id, weeks) in group {
                    weatherMap[id] = weeks
                }
            }
            weatherByLocation = weatherMap
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct CompanyMapMarker: Identifiable {
    let company: Company
    let coordinate: CLLocationCoordinate2D
    let weeks: [ForecastWeek]
    let weather: [WeatherWeek]

    var id: Int { company.id }
    var cashRisk: RiskLevel { weeks.map(\.risk).max(by: { $0.severity < $1.severity }) ?? .low }
    var weatherRisk: RiskLevel { weather.map(\.risk).max(by: { $0.severity < $1.severity }) ?? .low }
    var combinedRisk: RiskLevel { cashRisk.severity >= weatherRisk.severity ? cashRisk : weatherRisk }
    var deferredCashImpact: Double { weeks.reduce(0) { $0 + max(0, -$1.weatherAdjustment) } }
    var totalWeatherImpact: Double { weeks.reduce(0) { $0 + $1.weatherAdjustment } }
    var minClosingCash: Double { ForecastKpis(weeks: weeks).minClosingCash }
    var liveWeatherWeeks: Int { weeks.filter(\.isLive).count }
    var highWeatherWeeks: Int { weather.filter { $0.risk == .high }.count }
    var mediumWeatherWeeks: Int { weather.filter { $0.risk == .medium }.count }
    var currentRainWorkdays: Int { weather.first?.rainDays2mm ?? 0 }
}

private struct MapRiskMarker: View {
    let marker: CompanyMapMarker
    let selected: Bool

    var body: some View {
        Text(String(marker.company.displayName.prefix(1)))
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
            .frame(width: selected ? 38 : 32, height: selected ? 38 : 32)
            .background(marker.combinedRisk.color, in: Circle())
            .overlay(Circle().stroke(.white, lineWidth: 3))
            .shadow(color: marker.combinedRisk.color.opacity(0.35), radius: 6, x: 0, y: 3)
    }
}

private struct MapMarkerDetail: View {
    let marker: CompanyMapMarker

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(marker.company.displayName)
                        .font(.headline)
                    Text(marker.company.locationName ?? "No location")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                RiskBadge(risk: marker.combinedRisk)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                KpiCard(title: "Deferred", value: Format.eurCompact(marker.deferredCashImpact), subtitle: "weather timing", systemImage: "cloud.rain", tint: marker.deferredCashImpact > 0 ? .orange : .green)
                KpiCard(title: "Weather impact", value: Format.signedEur(marker.totalWeatherImpact), subtitle: "\(marker.liveWeatherWeeks) live weeks", systemImage: "arrow.left.arrow.right", tint: marker.totalWeatherImpact < 0 ? .red : .accentColor)
                KpiCard(title: "Min closing", value: Format.eurCompact(marker.minClosingCash), subtitle: "13-week low", systemImage: "banknote", tint: marker.minClosingCash < 0 ? .red : .accentColor)
                KpiCard(title: "Weather risk", value: marker.weatherRisk.label, subtitle: "\(marker.highWeatherWeeks) high, \(marker.mediumWeatherWeeks) medium", systemImage: "thermometer.sun", tint: marker.weatherRisk.color)
            }

            VStack(alignment: .leading, spacing: 6) {
                LabeledContent("Source", value: marker.company.sourceSystem ?? "Unknown")
                LabeledContent("Rain workdays", value: "\(marker.currentRainWorkdays) current week")
                LabeledContent("Coordinates", value: String(format: "%.4f, %.4f", marker.coordinate.latitude, marker.coordinate.longitude))
                if marker.company.usesProxyLocation {
                    Label("Dataset-level weather proxy, not a project coordinate", systemImage: "mappin.and.ellipse")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            .font(.caption)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct MapCompanyRow: View {
    let marker: CompanyMapMarker

    var body: some View {
        HStack(spacing: 12) {
            RiskDot(risk: marker.combinedRisk)
            VStack(alignment: .leading, spacing: 2) {
                Text(marker.company.displayName)
                    .font(.subheadline.weight(.semibold))
                Text(marker.company.locationName ?? "No location")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(Format.eurCompact(marker.deferredCashImpact))
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(marker.deferredCashImpact > 0 ? .orange : .secondary)
                Text("deferred")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            RiskBadge(risk: marker.combinedRisk, compact: true)
        }
        .padding(.vertical, 8)
    }
}
