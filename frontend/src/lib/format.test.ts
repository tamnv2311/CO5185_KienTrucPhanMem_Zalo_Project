import { describe, expect, it } from "vitest";
import { dayLabel, extractLinks, fileExt, fileSize, firstLetter, initials, matches, shortAgo } from "./format";

describe("format helpers", () => {
  it("builds initials from the last two words of a Vietnamese name", () => {
    expect(initials("Nguyễn Văn Tâm")).toBe("VT");
    expect(initials("Linh")).toBe("LI");
  });

  it("matches text without accents and case", () => {
    expect(matches("Trần Thùy Linh", "thuy")).toBe(true);
    expect(matches("Đỗ Đăng Khoa", "dang")).toBe(true);
    expect(matches("Lê Quang Minh", "hoa")).toBe(false);
  });

  it("formats file sizes and extensions", () => {
    expect(fileSize(512)).toBe("512 B");
    expect(fileSize(2_480_000)).toBe("2.4 MB");
    expect(fileExt("bao-cao.final.pdf")).toBe("PDF");
  });

  it("describes relative times", () => {
    const now = new Date(2026, 10, 10, 12, 0).getTime();
    expect(shortAgo(now - 30_000, now)).toBe("Vài giây");
    expect(shortAgo(now - 5 * 60_000, now)).toBe("5 phút");
    expect(dayLabel(now - 24 * 3600_000, now)).toBe("Hôm qua");
  });

  it("extracts links and alphabet buckets", () => {
    expect(extractLinks("xem https://a.dev/x và http://b.vn")).toEqual(["https://a.dev/x", "http://b.vn"]);
    expect(firstLetter("Đức")).toBe("D");
    expect(firstLetter("9x")).toBe("#");
  });
});
