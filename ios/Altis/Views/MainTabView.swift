import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            PortfolioView()
                .tabItem { Label("Portfolio", systemImage: "chart.bar.xaxis") }

            CompaniesView()
                .tabItem { Label("Companies", systemImage: "building.2") }

            MapView()
                .tabItem { Label("Map", systemImage: "map") }

            WeatherView()
                .tabItem { Label("Weather", systemImage: "cloud.sun.rain") }

            AboutView()
                .tabItem { Label("About", systemImage: "info.circle") }
        }
    }
}
