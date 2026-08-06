// Akno's text extractor, built on what macOS already has.
//
// §11 promises extraction on arrival, always — text layer first, OCR for scans. The
// usual way to get that is `brew install poppler tesseract`, which makes a memory
// layer's first-run experience depend on two unrelated projects being installed and
// on their CLI flags not changing.
//
// macOS ships both capabilities: PDFKit reads a text layer, and Vision does OCR that
// is faster and more accurate than tesseract, hardware-accelerated, and offline.
// Since Akno is macOS-only on purpose (see README), using the platform's own
// frameworks is the honest choice rather than a shortcut.
//
// Compiled on first use and cached in the state directory. Output is JSON on stdout
// so the caller never parses prose.

import Foundation
import PDFKit
import Vision
import CoreGraphics
import ImageIO

/// One page's worth of text, so a citation can name the page it came from.
///
/// §11 says a card points at the page, the document, **and the page number within it**.
/// One joined blob cannot support that last part, and a quote from page 9 of a contract
/// attributed to no page is a citation a reader cannot check.
struct Section: Encodable {
    var page: Int
    var text: String
}

struct Result: Encodable {
    var text: String
    var pages: Int
    var ocr: Bool
    /// Vision's own mean confidence over recognised lines, 0..1. Absent for a text
    /// layer, where there is nothing to be unsure about.
    var confidence: Double?
    var sections: [Section]?
    var error: String?
}

func emit(_ result: Result) -> Never {
    let encoder = JSONEncoder()
    encoder.outputFormatting = []
    if let data = try? encoder.encode(result), let json = String(data: data, encoding: .utf8) {
        print(json)
    } else {
        print("{\"text\":\"\",\"pages\":0,\"ocr\":false,\"error\":\"could not encode result\"}")
    }
    exit(0)
}

func fail(_ message: String) -> Never {
    emit(Result(text: "", pages: 0, ocr: false, confidence: nil, sections: nil, error: message))
}

/// Vision text recognition over one image. `accurate` rather than `fast`: this runs
/// once per document ever, and a wrong character in a policy number is permanent.
func recognise(_ image: CGImage) -> (String, Double)? {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    // Documents in this knowledge base are mixed-language; leaving the list broad
    // costs nothing measurable and stops a Dutch contract being read as English.
    if #available(macOS 13.0, *) {
        request.revision = VNRecognizeTextRequestRevision3
    }
    request.recognitionLanguages = ["en-US", "nl-NL", "de-DE", "fr-FR", "es-ES", "ru-RU"]

    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try handler.perform([request])
    } catch {
        return nil
    }

    guard let observations = request.results, !observations.isEmpty else { return ("", 0) }

    var lines: [String] = []
    var total = 0.0
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        lines.append(candidate.string)
        total += Double(candidate.confidence)
    }
    let mean = observations.isEmpty ? 0 : total / Double(observations.count)
    return (lines.joined(separator: "\n"), mean)
}

func loadImage(_ path: String) -> CGImage? {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else {
        return nil
    }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

/// Renders a PDF page for OCR. 2x is the sweet spot: enough resolution for Vision to
/// read small print, without the memory cost of rendering a 300dpi bitmap per page.
func render(_ page: PDFPage, scale: CGFloat = 2.0) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let width = Int(bounds.width * scale)
    let height = Int(bounds.height * scale)
    guard width > 0, height > 0, width * height < 40_000_000 else { return nil }

    guard
        let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        )
    else { return nil }

    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    return context.makeImage()
}

// ─── Entry ──────────────────────────────────────────────────────────────────

let arguments = CommandLine.arguments
guard arguments.count >= 3 else {
    fail("usage: akno-extract <pdf|image> <path> [--ocr-pages N] [--force-ocr]")
}

let mode = arguments[1]
let path = arguments[2]
var maxOcrPages = 12
var forceOcr = false
var index = 3
while index < arguments.count {
    if arguments[index] == "--ocr-pages", index + 1 < arguments.count {
        maxOcrPages = Int(arguments[index + 1]) ?? maxOcrPages
        index += 2
    } else if arguments[index] == "--force-ocr" {
        forceOcr = true
        index += 1
    } else {
        index += 1
    }
}

guard FileManager.default.fileExists(atPath: path) else { fail("no such file: \(path)") }

switch mode {
case "image":
    guard let image = loadImage(path) else { fail("could not decode the image") }
    guard let (text, confidence) = recognise(image) else { fail("Vision could not run") }
    emit(
        Result(
            text: text,
            pages: 1,
            ocr: true,
            confidence: confidence,
            sections: [Section(page: 1, text: text)],
            error: nil
        )
    )

case "pdf":
    guard let document = PDFDocument(url: URL(fileURLWithPath: path)) else {
        fail("could not open the PDF")
    }
    let pageCount = document.pageCount

    // Text layer first. §11's order is not arbitrary: a real text layer is exact,
    // while OCR of the same page is a guess that happens to be usually right.
    if !forceOcr, let layer = document.string {
        let trimmed = layer.trimmingCharacters(in: .whitespacesAndNewlines)
        // A scanned PDF often carries a few stray characters — a stamp, a page
        // number — which is not a text layer. Judged per page so a 40-page scan
        // with one typed cover sheet still gets OCR'd.
        let perPage = pageCount > 0 ? trimmed.count / pageCount : trimmed.count
        if perPage >= 40 {
            // Page by page as well as joined: the join is what a summary reads, the
            // sections are what a citation points into.
            var sections: [Section] = []
            for pageIndex in 0..<pageCount {
                guard let page = document.page(at: pageIndex), let pageText = page.string else { continue }
                let pageTrimmed = pageText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !pageTrimmed.isEmpty { sections.append(Section(page: pageIndex + 1, text: pageTrimmed)) }
            }
            emit(
                Result(
                    text: trimmed,
                    pages: pageCount,
                    ocr: false,
                    confidence: nil,
                    sections: sections.isEmpty ? nil : sections,
                    error: nil
                )
            )
        }
    }

    // No usable text layer: it is a scan. OCR a bounded number of pages — a 200-page
    // contract does not need every page to be searchable to be findable, and the
    // caller is told how many were read.
    var sections: [Section] = []
    var confidenceTotal = 0.0
    var read = 0
    for pageIndex in 0..<min(pageCount, maxOcrPages) {
        guard let page = document.page(at: pageIndex), let image = render(page) else { continue }
        guard let (text, confidence) = recognise(image) else { continue }
        if !text.isEmpty {
            sections.append(Section(page: pageIndex + 1, text: text))
            confidenceTotal += confidence
            read += 1
        }
    }

    let mean = read > 0 ? confidenceTotal / Double(read) : 0
    emit(
        Result(
            text: sections.map(\.text).joined(separator: "\n\n"),
            pages: pageCount,
            ocr: true,
            confidence: mean,
            sections: sections.isEmpty ? nil : sections,
            error: nil
        )
    )

default:
    fail("unknown mode: \(mode)")
}
