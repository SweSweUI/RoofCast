import Foundation

/// Money / date formatting, ported from the web app's `lib/format.ts` so the
/// iOS and web surfaces read identically.
enum Format {

    /// Grouped euros, rounded: `€2,062,523`.
    static func eur(_ x: Double?) -> String {
        guard let x, x.isFinite else { return "–" }
        return "€" + grouped(x.rounded())
    }

    /// Compact euros: `€1.2M` / `€189k` / `€820`. Negative uses a minus sign.
    static func eurCompact(_ x: Double?) -> String {
        guard let x, x.isFinite else { return "–" }
        let a = abs(x)
        let sign = x < 0 ? "−" : ""
        if a >= 1_000_000 {
            let digits = a >= 10_000_000 ? 0 : 1
            return "\(sign)€\(trim(a / 1_000_000, digits: digits))M"
        }
        if a >= 1_000 {
            return "\(sign)€\(Int((a / 1_000).rounded()))k"
        }
        return "\(sign)€\(Int(a.rounded()))"
    }

    /// Signed euros: `+€242,523` / `−€18,900`.
    static func signedEur(_ x: Double?) -> String {
        guard let x, x.isFinite else { return "–" }
        let body = "€" + grouped(abs(x).rounded())
        return x < 0 ? "−\(body)" : "+\(body)"
    }

    /// A delay score with one decimal: `19.6`.
    static func score(_ x: Double?) -> String {
        guard let x, x.isFinite else { return "–" }
        return trim(x, digits: 1)
    }

    /// "1 Jun" for a `yyyy-MM-dd` week key.
    static func weekShort(_ weekStart: String) -> String {
        guard let d = parse(weekStart) else { return weekStart }
        return dayMonth.string(from: d)
    }

    /// "1–7 Jun" range for a Monday week key.
    static func weekRange(_ weekStart: String) -> String {
        guard let a = parse(weekStart),
              let b = Calendar.utc.date(byAdding: .day, value: 6, to: a)
        else { return weekStart }
        let sameMonth = monthOnly.string(from: a) == monthOnly.string(from: b)
        if sameMonth {
            return "\(dayOnly.string(from: a))–\(dayMonth.string(from: b))"
        }
        return "\(dayMonth.string(from: a)) – \(dayMonth.string(from: b))"
    }

    /// "1 Jun 2026" for a full date key.
    static func dateLong(_ weekStart: String) -> String {
        guard let d = parse(weekStart) else { return weekStart }
        return dayMonthYear.string(from: d)
    }

    // MARK: - Internals

    private static func grouped(_ value: Double) -> String {
        groupingFormatter.string(from: NSNumber(value: value)) ?? String(Int(value))
    }

    /// Format with up to `digits` decimals, trimming trailing zeros.
    private static func trim(_ value: Double, digits: Int) -> String {
        let s = String(format: "%.\(digits)f", value)
        if s.contains(".") {
            var t = s
            while t.hasSuffix("0") { t.removeLast() }
            if t.hasSuffix(".") { t.removeLast() }
            return t
        }
        return s
    }

    private static func parse(_ key: String) -> Date? {
        isoDay.date(from: key)
    }

    private static let groupingFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = ","
        f.maximumFractionDigits = 0
        f.locale = Locale(identifier: "en_US")
        return f
    }()

    private static let isoDay: DateFormatter = makeUTC("yyyy-MM-dd")
    private static let dayMonth: DateFormatter = makeUTC("d MMM")
    private static let dayOnly: DateFormatter = makeUTC("d")
    private static let monthOnly: DateFormatter = makeUTC("MMM")
    private static let dayMonthYear: DateFormatter = makeUTC("d MMM yyyy")

    private static func makeUTC(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = format
        return f
    }
}

private extension Calendar {
    /// UTC calendar so week-key date math never shifts across the local TZ.
    static let utc: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()
}
