import AppKit
import Foundation

struct Slide {
    let imageName: String
    let badge: String
    let eyebrow: String
    let title: String
    let subtitle: String
    let closing: Bool
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let artifactDir = root.appendingPathComponent("artifacts/project-intro-video")
let screenDir = artifactDir.appendingPathComponent("screens")
let slideDir = artifactDir.appendingPathComponent("slides")

try FileManager.default.createDirectory(at: slideDir, withIntermediateDirectories: true)

let slides = [
    Slide(
        imageName: "worldcup-home.png",
        badge: "00:00",
        eyebrow: "PROJECT INTRO",
        title: "ArcPredict",
        subtitle: "USDC prediction markets on Arc Testnet.",
        closing: false
    ),
    Slide(
        imageName: "crypto-home.png",
        badge: "CRYPTO",
        eyebrow: "BOARD ONE",
        title: "Pyth-backed price markets",
        subtitle: "BTC, ETH, and SOL markets with visible deadlines, pools, and user positions.",
        closing: false
    ),
    Slide(
        imageName: "crypto-home.png",
        badge: "UX",
        eyebrow: "MARKET CARDS",
        title: "Readable before tradable",
        subtitle: "The question, split, liquidity, and close time are visible before a user places a bet.",
        closing: false
    ),
    Slide(
        imageName: "worldcup-home.png",
        badge: "WORLD CUP",
        eyebrow: "NEW CATEGORY",
        title: "From prices to events",
        subtitle: "The World Cup board adds home win, draw, away win, spread, and winner markets.",
        closing: false
    ),
    Slide(
        imageName: "worldcup-scrolled.png",
        badge: "EVENT MARKETS",
        eyebrow: "MULTI-OUTCOME",
        title: "Built for the sport",
        subtitle: "EventMarket supports more than two outcomes while keeping the same USDC user flow.",
        closing: false
    ),
    Slide(
        imageName: "worldcup-home.png",
        badge: "SETTLEMENT",
        eyebrow: "ORACLE PATH",
        title: "Explicit trust assumptions",
        subtitle: "AdminEventOracle uses result proposals, a 72-hour dispute window, and finalization.",
        closing: false
    ),
    Slide(
        imageName: "worldcup-home.png",
        badge: "ARCPREDICT",
        eyebrow: "CLOSING",
        title: "Understand. Trade. Settle.",
        subtitle: "One interface for markets people can understand and settle on-chain.",
        closing: true
    ),
]

let canvasSize = NSSize(width: 1280, height: 720)
let paragraphStyle = NSMutableParagraphStyle()
paragraphStyle.lineBreakMode = .byWordWrapping
paragraphStyle.alignment = .left

func color(_ red: CGFloat, _ green: CGFloat, _ blue: CGFloat, _ alpha: CGFloat = 1) -> NSColor {
    NSColor(calibratedRed: red / 255, green: green / 255, blue: blue / 255, alpha: alpha)
}

func drawRoundedRect(_ rect: NSRect, radius: CGFloat, fill: NSColor) {
    fill.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func drawText(_ text: String, in rect: NSRect, font: NSFont, color: NSColor, kern: CGFloat = 0) {
    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .kern: kern,
        .paragraphStyle: paragraphStyle,
    ]
    text.draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
}

func drawBackground(_ image: NSImage) {
    color(5, 8, 22).setFill()
    NSRect(origin: .zero, size: canvasSize).fill()

    let scale = max(canvasSize.width / image.size.width, canvasSize.height / image.size.height)
    let drawSize = NSSize(width: image.size.width * scale, height: image.size.height * scale)
    let drawRect = NSRect(
        x: (canvasSize.width - drawSize.width) / 2,
        y: (canvasSize.height - drawSize.height) / 2,
        width: drawSize.width,
        height: drawSize.height
    )
    image.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1)

    color(3, 6, 20, 0.36).setFill()
    NSRect(origin: .zero, size: canvasSize).fill()
}

func render(slide: Slide, index: Int) throws {
    let imageURL = screenDir.appendingPathComponent(slide.imageName)
    guard let background = NSImage(contentsOf: imageURL) else {
        throw NSError(domain: "render_slides", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing image \(imageURL.path)"])
    }

    let output = NSImage(size: canvasSize)
    output.lockFocus()
    drawBackground(background)

    let badgeAttributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
        .foregroundColor: color(223, 238, 255),
        .kern: 2.1,
    ]
    let badgeSize = (slide.badge as NSString).size(withAttributes: badgeAttributes)
    let badgeRect = NSRect(x: canvasSize.width - badgeSize.width - 66, y: 654, width: badgeSize.width + 28, height: 34)
    drawRoundedRect(badgeRect, radius: 17, fill: color(5, 8, 22, 0.72))
    (slide.badge as NSString).draw(at: NSPoint(x: badgeRect.minX + 14, y: badgeRect.minY + 9), withAttributes: badgeAttributes)

    let panelRect: NSRect
    if slide.closing {
        panelRect = NSRect(x: 42, y: 318, width: 1196, height: 250)
    } else {
        panelRect = NSRect(x: 42, y: 54, width: 1196, height: 160)
    }
    drawRoundedRect(panelRect, radius: 18, fill: color(5, 8, 22, 0.78))
    color(77, 168, 255, 0.96).setFill()
    NSRect(x: panelRect.minX, y: panelRect.minY, width: 5, height: panelRect.height).fill()

    let left = panelRect.minX + 30
    drawText(
        slide.eyebrow,
        in: NSRect(x: left, y: panelRect.maxY - 38, width: 980, height: 22),
        font: NSFont.systemFont(ofSize: 14, weight: .bold),
        color: color(103, 255, 181),
        kern: 3.2
    )
    drawText(
        slide.title,
        in: NSRect(x: left, y: panelRect.maxY - (slide.closing ? 112 : 91), width: 1070, height: slide.closing ? 72 : 54),
        font: NSFont.systemFont(ofSize: slide.closing ? 58 : 42, weight: .bold),
        color: .white
    )
    drawText(
        slide.subtitle,
        in: NSRect(x: left + 2, y: panelRect.minY + (slide.closing ? 42 : 27), width: 1060, height: slide.closing ? 84 : 40),
        font: NSFont.systemFont(ofSize: slide.closing ? 29 : 24, weight: .regular),
        color: color(184, 215, 255)
    )

    output.unlockFocus()

    guard let tiff = output.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "render_slides", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to encode slide \(index)"])
    }

    let path = slideDir.appendingPathComponent(String(format: "slide-%02d.png", index))
    try png.write(to: path)
    print(path.path)
}

for (index, slide) in slides.enumerated() {
    try render(slide: slide, index: index)
}
