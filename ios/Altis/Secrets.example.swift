import Foundation

// COMMITTED TEMPLATE. Copy to `Secrets.swift` (gitignored) and fill in the two
// values from the project's `.env.local`:
//   NEXT_PUBLIC_SUPABASE_URL      -> supabaseURL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY -> supabaseAnonKey
//
// The anon key is a public client key and is safe to ship in an app binary
// (it only grants RLS-protected, authenticated reads). It is kept out of git
// purely for governance hygiene.
//
// NOTE: only ONE of Secrets.swift / Secrets.example.swift is compiled. The
// xcodegen target excludes Secrets.example.swift from the build so the two
// `enum Secrets` declarations never collide.
enum Secrets {
    static let supabaseURL = "https://YOUR-PROJECT.supabase.co"
    static let supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY"
}
