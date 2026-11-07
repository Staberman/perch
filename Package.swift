// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Perch",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "perch-overlay", targets: ["PerchOverlay"]),
        .library(name: "PerchCore", targets: ["PerchCore"]),
    ],
    targets: [
        .target(name: "PerchCore", resources: [.copy("Resources/characters.json")]),
        .executableTarget(name: "PerchOverlay", dependencies: ["PerchCore"]),
        // Command Line Tools 15 ship no XCTest, so the tests are an executable: `swift run PerchCoreTests`.
        .executableTarget(name: "PerchCoreTests", dependencies: ["PerchCore"], path: "Tests/PerchCoreTests"),
    ]
)
