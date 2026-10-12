// เนื้อหาสไลด์ UP Drive — ปัญหา / ผู้ใช้ / ฟีเจอร์
// ใช้ร่วมกันระหว่าง build-pptx.mjs และ build-html.mjs

export const BRAND = {
  primary: "5B21B6",
  primaryDark: "401681",
  primarySoft: "EDE9FE",
  secondary: "F59E0B",
  secondarySoft: "FEF3C7",
  text: "1F2937",
  muted: "6B7280",
  bg: "F5F7FB",
  card: "FFFFFF",
  border: "E5E7EB",
  success: "16A34A",
  successSoft: "DCFCE7",
  danger: "DC2626",
};

export const META = {
  footer: "UP Drive · ระบบแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา",
  url: "https://up-drive.vercel.app",
};

export const SLIDES = [
  {
    kind: "title",
    eyebrow: "โครงงานระบบสารสนเทศ",
    title: "UP Drive",
    subtitle: "ระบบแชร์ค่าเดินทางสำหรับนักศึกษา มหาวิทยาลัยพะเยา",
    tags: ["📍 GPS", "🗺️ แผนที่", "🚗 Driver", "⚡ Realtime"],
  },

  {
    kind: "bullets",
    title: "ปัญหาที่พบ",
    emoji: "😣",
    accent: BRAND.danger,
    items: [
      "นักศึกษาเดินทางเข้า–ออกมหาวิทยาลัย/หอพักทุกวัน ถ้าไปคนเดียวค่าเดินทางสูง",
      "หาคนร่วมทางยาก ต้องนัดกันเองผ่าน LINE/Facebook ไม่มีระบบช่วยจับคู่",
      "ไม่มีข้อมูลพิกัดและเส้นทาง ทำให้นัดรับ–ส่งคลาดเคลื่อน เสียเวลา",
      "คนขับไม่มีช่องทางรับงานอย่างเป็นระบบ มองไม่เห็นงานที่รออยู่",
      "รถวิ่งไม่เต็มคัน → ต้นทุนต่อคนสูง จราจรและมลพิษเพิ่มขึ้น",
    ],
  },

  {
    kind: "cards",
    title: "ผู้ใช้ระบบ",
    emoji: "👥",
    cards: [
      {
        icon: "👤",
        title: "ผู้โดยสาร (Passenger)",
        lines: [
          "นักศึกษา ม.พะเยา ที่ต้องการเดินทาง",
          "อยากแชร์ค่าคันรถให้ถูกลง",
          "หาคนร่วมทางเส้นทางเดียวกัน",
          "ปักหมุดจุดรับ–ส่งบนแผนที่",
        ],
      },
      {
        icon: "🚗",
        title: "คนขับ (Driver)",
        lines: [
          "นักศึกษาที่มีรถและว่างรับงาน",
          "แชร์ค่าเชื้อเพลิง / มีรายได้เสริม",
          "ดูงานว่างและกดรับงาน",
          "ส่งตำแหน่ง GPS แบบ Realtime",
        ],
      },
      {
        icon: "🛠️",
        title: "ผู้ดูแลระบบ (Admin)",
        lines: [
          "จัดการฐานข้อมูลและความปลอดภัย",
          "ดูแลโครงสร้างตาราง (schema)",
          "Trigger / Function / Procedure",
        ],
      },
    ],
  },

  {
    kind: "steps",
    title: "การทำงานของระบบ",
    emoji: "🔄",
    steps: [
      "สมัคร / เข้าสู่ระบบ",
      "ประกาศเส้นทาง + ปักหมุด",
      "จับคู่กลุ่มอัตโนมัติ",
      "ยืนยันสมาชิก",
      "ส่งงานให้คนขับ",
      "คนขับรับงาน",
      "ติดตาม Realtime",
      "เสร็จสิ้น + ประวัติ",
    ],
  },

  {
    kind: "bullets",
    title: "ฟีเจอร์ — ผู้โดยสาร",
    emoji: "✨",
    items: [
      "สมัคร/เข้าสู่ระบบด้วย Supabase Auth แยกบทบาทผู้ใช้",
      "ประกาศความต้องการเดินทาง: ต้นทาง–ปลายทาง + รายละเอียด + ปักหมุด GPS",
      "กำหนดจำนวนผู้โดยสารเป้าหมายของกลุ่ม",
      "จับคู่กลุ่มอัตโนมัติ (find_candidate_groups) รวมคนที่ไปทางเดียวกัน",
      "จัดการกลุ่มเดินทาง: ดูสมาชิก / ยืนยัน / ยกเลิก",
      "แผนที่ + เส้นทางจริง (OSRM) พร้อมระยะทางและเวลา",
      "ติดตามสถานะแบบ Realtime และดูประวัติการเดินทาง",
    ],
  },

  {
    kind: "bullets",
    title: "ฟีเจอร์ — คนขับ",
    emoji: "✨",
    items: [
      "Driver Dashboard แสดงงานที่รอรับ (jobs)",
      "ดูรายละเอียดงานและเส้นทางบนแผนที่ พร้อมจุดรับ–ส่ง",
      "กดรับงาน → สถานะเปลี่ยนเป็น accepted",
      "ส่งตำแหน่ง GPS แบบ Realtime (driver_locations)",
      "ดูประวัติงานที่เคยรับ",
    ],
  },

  {
    kind: "cards",
    title: "เทคโนโลยีและฐานข้อมูล",
    emoji: "🧩",
    note: "Trigger 3 · SQL Function 3 · Stored Procedure 3 · deploy แล้วบน Vercel",
    cards: [
      {
        icon: "🌐",
        title: "Frontend",
        lines: ["HTML / CSS / JavaScript", "Leaflet (แผนที่)", "Responsive ใช้บนมือถือ"],
      },
      {
        icon: "⚙️",
        title: "Backend",
        lines: ["Node.js + Express", "REST API", "ตรวจสอบสิทธิ์ด้วย Supabase"],
      },
      {
        icon: "🗄️",
        title: "Database",
        lines: ["Supabase (PostgreSQL)", "6 ตาราง + ride_group_events", "Auth + Realtime"],
      },
    ],
  },

  {
    kind: "summary",
    title: "สรุปและจุดเด่น",
    emoji: "🎯",
    items: [
      ["ลดค่าใช้จ่าย", "แชร์ค่ารถร่วมกันต่อเที่ยว"],
      ["จับคู่อัตโนมัติ", "ไม่ต้องนัดกันเองเหมือนเดิม"],
      ["ใช้งานง่าย", "แผนที่ + GPS + Realtime"],
      ["พร้อมใช้งานจริง", "deploy แล้วบน Vercel"],
    ],
  },
];
