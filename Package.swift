// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Tomari",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "tomari-overlay", targets: ["TomariOverlay"]),
        .library(name: "TomariCore", targets: ["TomariCore"]),
    ],
    targets: [
        .target(name: "TomariCore", resources: [.copy("Resources/characters.json")]),
        .executableTarget(name: "TomariOverlay", dependencies: ["TomariCore"]),
        // Command Line Tools 15 ship no XCTest, so the tests are an executable: `swift run TomariCoreTests`.
        .executableTarget(name: "TomariCoreTests", dependencies: ["TomariCore"], path: "Tests/TomariCoreTests"),
    ]
)
