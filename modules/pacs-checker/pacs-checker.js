const DEFAULT_KNOWLEDGE = {
  source: {
    project: "Sakura PACS",
    notes: ["Fallback knowledge. Mo qua local server de load day du file pacs-knowledge.json."]
  },
  messageTypes: {
    order: {
      label: "Ban tin gui chi dinh PACS",
      endpoint: "GET /pacs/chi-dinh",
      hl7: "OMI^O23^OMI_O23",
      direction: "HIS -> PACS",
      requiredSegments: ["MSH", "PID", "PV1", "ORC", "OBR"]
    },
    status: {
      label: "Ban tin cap nhat trang thai PACS",
      endpoint: "POST /pacs/trang-thai",
      hl7: "OMI^O23^OMI_O23",
      direction: "PACS -> HIS",
      requiredSegments: ["MSH", "PID", "ORC", "OBR"]
    },
    result: {
      label: "Ban tin tra ket qua PACS",
      endpoint: "POST /pacs/ket-qua",
      hl7: "ORU^R01^ORU_R01",
      direction: "PACS -> HIS",
      requiredSegments: ["MSH", "PID", "ORC", "OBR", "OBX"]
    },
    patient: {
      label: "Ban tin cap nhat nguoi benh",
      endpoint: "PACS update patient",
      hl7: "ADT^A08^ADT_A01",
      direction: "HIS -> PACS",
      requiredSegments: ["MSH", "PID", "PV1"]
    }
  },
  statusMap: {
    OR: { hisStatus: "DA_TIEP_NHAN/DA_LAY_MAU", note: "Da thuc hien hoac da lay mau." },
    SC: { hisStatus: "DA_TIEP_NHAN", note: "Da tiep nhan dich vu." },
    BX: { hisStatus: "DA_TIEP_NHAN", note: "Da tiep nhan dich vu." },
    CA: { hisStatus: "CHO_TIEP_NHAN", note: "Huy tiep nhan." },
    RC: { hisStatus: "CHO_TIEP_NHAN", note: "Huy tiep nhan." }
  },
  obxResultMap: {
    1: { dto: "ketQua", note: "Mo ta/ket qua chinh." },
    2: { dto: "ketLuan", note: "Ket luan." },
    3: { dto: "phieuKetQua", note: "Noi dung phieu." },
    4: { dto: "anhKetQua", note: "Link anh chinh." },
    5: { dto: "canhBao", note: "Canh bao." },
    6: { dto: "anhKetQua2", note: "Link anh bo sung." }
  },
  fields: []
};

let hl7Knowledge = DEFAULT_KNOWLEDGE;
let lastRenderState = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadKnowledge();
  bindControls();
  updateKnowledgeSummary();
  renderWikiOnly();
});

async function loadKnowledge() {
  try {
    const response = await fetch("./pacs-knowledge.json", { cache: "no-store" });
    if (response.ok) {
      hl7Knowledge = await response.json();
    }
  } catch (error) {
    console.warn("Cannot load pacs-knowledge.json, using fallback knowledge.", error);
  }
}

function bindControls() {
  document.getElementById("checkBtn").addEventListener("click", checkMessage);
  document.getElementById("demoResultBtn").addEventListener("click", convertToORU);
  document.getElementById("demoStatusBtn").addEventListener("click", generateStatusUpdate);
  document.getElementById("copyBtn").addEventListener("click", copyOutput);
  document.getElementById("messageMode").addEventListener("change", () => {
    if (document.getElementById("inputData").value.trim()) checkMessage();
    else renderWikiOnly();
  });
  document.getElementById("searchInput").addEventListener("input", () => {
    if (lastRenderState) {
      renderCheckResult(lastRenderState.parsed, lastRenderState.mode, lastRenderState.check);
    } else {
      renderWikiOnly();
    }
  });
}


function readInputData() {
  const rawValue = document.getElementById("inputData").value.trim();
  if (!rawValue) throw new Error("Chua co du lieu dau vao.");

  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed.Hl7Data === "string") return parsed.Hl7Data;
    if (parsed && typeof parsed.data === "string") return parsed.data;
    if (parsed && typeof parsed.hl7Data === "string") return parsed.hl7Data;
  } catch (ignore) {
    return rawValue;
  }

  throw new Error('Dau vao JSON can co field "Hl7Data" hoac "data" dang chuoi HL7.');
}

function normalizeHl7(raw) {
  return String(raw || "")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .split("\r")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\r");
}

function parseHl7(raw) {
  const data = normalizeHl7(raw);
  const segments = data.split("\r").map((line, index) => {
    const fields = line.split("|");
    return { index, raw: line, name: fields[0], fields };
  });

  const byName = segments.reduce((map, segment) => {
    if (!map[segment.name]) map[segment.name] = [];
    map[segment.name].push(segment);
    return map;
  }, {});

  return {
    data,
    segments,
    byName,
    msh: first(byName.MSH),
    pid: first(byName.PID),
    pv1: first(byName.PV1),
    orders: buildOrderGroups(segments)
  };
}

function buildOrderGroups(segments) {
  const groups = [];
  let current = null;
  let looseOrc = null;

  for (const segment of segments) {
    if (segment.name === "ORC") {
      looseOrc = segment;
      current = { orc: segment, obr: null, obx: [], nte: [], tq1: null };
      groups.push(current);
      continue;
    }

    if (segment.name === "OBR") {
      if (!current || current.obr) {
        current = { orc: looseOrc, obr: null, obx: [], nte: [], tq1: null };
        groups.push(current);
      }
      current.obr = segment;
      continue;
    }

    if (!current) continue;
    if (segment.name === "OBX") current.obx.push(segment);
    if (segment.name === "NTE") current.nte.push(segment);
    if (segment.name === "TQ1") current.tq1 = segment;
  }

  return groups.filter((group) => group.orc || group.obr || group.obx.length);
}

function first(values) {
  return values && values.length ? values[0] : null;
}

function detectMessageType(parsed) {
  const msh9 = getValue(parsed.msh, 9);
  if (msh9.includes("ORU^R01")) return "result";
  if (msh9.includes("ADT^A08")) return "patient";
  if (msh9.includes("OMI^O23") || msh9.includes("OML^O21")) {
    const orderControl = getValue(first(parsed.byName.ORC), 1, 1);
    if (hl7Knowledge.statusMap?.[orderControl] && orderControl !== "NW") return "status";
    return "order";
  }
  return parsed.byName.OBX?.length ? "result" : "order";
}

function selectedMode(parsed) {
  const mode = document.getElementById("messageMode").value;
  return mode === "auto" ? detectMessageType(parsed) : mode;
}

function checkMessage() {
  try {
    const parsed = parseHl7(readInputData());
    const mode = selectedMode(parsed);
    const check = buildCheckResult(parsed, mode);
    renderCheckResult(parsed, mode, check);
  } catch (error) {
    renderError(error.message);
  }
}

function buildCheckResult(parsed, mode) {
  const definition = hl7Knowledge.messageTypes[mode] || hl7Knowledge.messageTypes.order;
  const issues = [];

  for (const segmentName of definition.requiredSegments || []) {
    if (!parsed.byName[segmentName] || parsed.byName[segmentName].length === 0) {
      issues.push({ level: "error", message: `Thieu segment bat buoc ${segmentName}.` });
    }
  }

  if (!getValue(parsed.pid, 3, 1)) {
    issues.push({ level: "warn", message: "Thieu PID-3.1 maHoSo de doi chieu nguoi benh." });
  }
  if (!getValue(parsed.pid, 3, 2)) {
    issues.push({ level: "warn", message: "Thieu PID-3.2 maNb." });
  }

  if (mode === "order" && !getValue(parsed.msh, 10)) {
    issues.push({ level: "error", message: "Thieu MSH-10 soPhieu tren ban tin chi dinh." });
  }

  if (mode === "order") {
    parsed.orders.forEach((group, index) => {
      if (!getValue(group.orc, 1, 1)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu ORC-1 ma lenh chi dinh.` });
      }
      if (!getValue(group.obr, 2, 1)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-2 soKetNoi.` });
      }
      if (!getValue(group.obr, 4, 1)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-4.1 maKetNoi dich vu.` });
      }
    });
  }

  if (mode === "status") {
    parsed.orders.forEach((group, index) => {
      const orderControl = getValue(group.orc, 1, 1);
      if (!orderControl) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu ORC-1 de map trang thai.` });
      } else if (!hl7Knowledge.statusMap?.[orderControl]) {
        issues.push({ level: "error", message: `Order ${index + 1}: ORC-1=${orderControl} chua co trong map trang thai PACS.` });
      }
      if (!getValue(group.obr, 2, 1)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-2 soKetNoi.` });
      }
      if (!getValue(group.obr, 4, 1)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-4.1 maKetNoi dich vu.` });
      }
    });
  }

  if (mode === "result") {
    if (!getValue(first(parsed.byName.ORC), 2, 1) && !getValue(parsed.msh, 10)) {
      issues.push({ level: "error", message: "Thieu ORC-2/MSH-10 soPhieu tren ban tin ket qua." });
    }
    parsed.orders.forEach((group, index) => {
      if (!getValue(group.obr, 2, 1)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-2 soKetNoi.` });
      }
      if (!getValue(group.obr, 22, 1)) {
        issues.push({ level: "warn", message: `Order ${index + 1}: chua co OBR-22 thoiGianCoKetQua.` });
      }
      if (!group.obx.length) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBX ket qua.` });
      }
      group.obx.forEach((obx) => {
        const setId = getValue(obx, 1, 1);
        if (!getValue(obx, 5)) {
          issues.push({ level: "error", message: `Order ${index + 1}: OBX-${setId || "?"} thieu OBX-5 gia tri ket qua.` });
        }
        if (setId && !hl7Knowledge.obxResultMap?.[setId]) {
          issues.push({ level: "warn", message: `Order ${index + 1}: OBX-1=${setId} chua nam trong map ket qua PACS.` });
        }
      });
    });
  }

  return {
    issues,
    dto: buildDtoPreview(parsed, mode),
    fields: collectFields(parsed, mode),
    rawFields: collectRawFields(parsed)
  };
}

function buildDtoPreview(parsed, mode) {
  const dto = {
    endpoint: hl7Knowledge.messageTypes[mode]?.endpoint,
    messageType: getValue(parsed.msh, 9),
    maHoSo: getValue(parsed.pid, 3, 1) || getValue(parsed.pv1, 19, 1),
    maNb: getValue(parsed.pid, 3, 2),
    maNbNormalized: normalizeMaNb(getValue(parsed.pid, 3, 2)),
    soPhieu: getValue(first(parsed.byName.ORC), 2, 1) || getValue(parsed.msh, 10),
    dsDichVu: []
  };

  parsed.orders.forEach((group, index) => {
    const statusCode = getValue(group.orc, 1, 1);
    const item = {
      stt: index + 1,
      soKetNoi: getValue(group.obr, 2, 1),
      maKetNoi: getValue(group.obr, 4, 1),
      tenDichVu: getValue(group.obr, 4, 2),
      modality: getValue(group.obr, 24, 1),
      thoiGianThucHien: getValue(group.orc, 16, 1) || getValue(group.obr, 7, 1) || getValue(group.obr, 6, 1)
    };

    if (mode === "order") {
      item.orderControl = statusCode;
      item.soPhieu = getValue(group.orc, 2, 1) || getValue(parsed.msh, 10);
      item.maPhongThucHien = getValue(group.orc, 3, 1) || getValue(group.orc, 21, 1) || getValue(group.obr, 3, 1);
      item.thoiGianChiDinh = getValue(group.tq1, 7, 1) || getValue(group.orc, 9, 1);
      item.thoiGianTiepNhan = getValue(group.obr, 7, 1);
      item.khoaChiDinh = getValue(group.obr, 18, 1);
      item.khoaThucHien = getValue(group.obr, 20, 1);
      item.hinhThucDiChuyen = getValue(group.obr, 30, 1);
      item.chanDoan = getValue(group.obr, 31, 1) || getValue(group.obr, 13, 1);
      item.ghiChu = getValue(group.obr, 39, 2);
      item.thanhToan = getValue(group.obr, 9, 1);
    }

    if (mode === "status") {
      item.trangThai2 = statusCode;
      item.trangThai = hl7Knowledge.statusMap?.[statusCode]?.hisStatus || null;
      item.thoiGianTiepNhan = getValue(group.orc, 15, 1);
      item.thoiGianTiepNhanMau = getValue(group.orc, 15, 1);
      item.maNguoiTiepNhan = getValue(group.orc, 10, 1);
      item.maNguoiThucHien = getValue(group.obr, 34, 1);
      item.maPhuThucHien1 = getValue(group.obr, 38, 1);
      item.maPhongThucHien = getValue(group.orc, 3, 1) || getValue(group.orc, 21, 1);
    }

    if (mode === "result") {
      item.thoiGianTiepNhanMau = getValue(group.orc, 15, 1);
      item.thoiGianCoKetQua = getValue(group.obr, 22, 1);
      item.maNguoiDocKetQua = getValue(group.obr, 32, 1);
      item.maNguoiThucHien = getValue(group.obr, 34, 1);
      item.maDieuDuong = getValue(group.obr, 35, 1);
      item.maPhuThucHien1 = getValue(group.obr, 38, 1);
      item.ketQuaPacs = parsePacsObx(group.obx);
      item.maMay = firstNonEmpty(group.obx.map((obx) => getValue(obx, 18, 1)));
    }

    dto.dsDichVu.push(item);
  });

  return dto;
}

function parsePacsObx(obxSegments) {
  const result = {};
  obxSegments.forEach((obx) => {
    const setId = getValue(obx, 1, 1);
    const target = hl7Knowledge.obxResultMap?.[setId]?.dto || `obx${setId || "Unknown"}`;
    result[target] = getValue(obx, 5);
  });
  return result;
}

function collectFields(parsed, mode) {
  return wikiFieldsForMode(mode).flatMap((field) => {
    const segments = segmentsForField(parsed, field.segment);

    if (!segments.length) {
      return [{ ...field, displayPath: field.path, occurrence: "", value: "" }];
    }

    return segments.map((segment, index) => ({
      ...field,
      displayPath: occurrencePath(field, segment, index),
      occurrence: `${segment.name}[${index + 1}]`,
      value: getValue(segment, field.field, field.component)
    }));
  });
}

function wikiFieldsForMode(mode) {
  if (mode === "all") return hl7Knowledge.fields || [];
  return (hl7Knowledge.fields || []).filter((field) => field.message === "common" || field.message === mode);
}

function segmentsForField(parsed, segmentName) {
  if (segmentName === "OBX") return parsed.orders.flatMap((group) => group.obx);
  if (["ORC", "OBR", "TQ1"].includes(segmentName)) {
    return parsed.orders.map((group) => group[segmentName.toLowerCase()]).filter(Boolean);
  }
  if (segmentName === "NTE") return parsed.orders.flatMap((group) => group.nte);
  return parsed.byName[segmentName] || [];
}

function occurrencePath(field, segment, index) {
  const componentSuffix = field.component ? `.${field.component}` : "";
  return `${segment.name}[${index + 1}]-${field.field}${componentSuffix}`;
}

function collectRawFields(parsed) {
  const occurrenceBySegment = {};

  return parsed.segments.flatMap((segment) => {
    const rows = [];
    occurrenceBySegment[segment.name] = (occurrenceBySegment[segment.name] || 0) + 1;
    const occurrence = occurrenceBySegment[segment.name];
    const start = segment.name === "MSH" ? 2 : 1;

    if (segment.name === "MSH") rows.push(rawFieldRow(segment, occurrence, 1, 0, "|"));

    for (let fieldNumber = start; fieldNumber < segment.fields.length; fieldNumber++) {
      const value = getValue(segment, fieldNumber);
      rows.push(rawFieldRow(segment, occurrence, fieldNumber, 0, value));

      const components = String(value || "").split("^");
      if (components.length > 1) {
        components.forEach((componentValue, index) => {
          rows.push(rawFieldRow(segment, occurrence, fieldNumber, index + 1, componentValue));
        });
      }
    }

    return rows;
  });
}

function rawFieldRow(segment, occurrence, fieldNumber, componentNumber, value) {
  const componentSuffix = componentNumber ? `.${componentNumber}` : "";
  return {
    message: "raw",
    segment: segment.name,
    field: fieldNumber,
    component: componentNumber,
    path: `${segment.name}-${fieldNumber}${componentSuffix}`,
    displayPath: `${segment.name}[${occurrence}]-${fieldNumber}${componentSuffix}`,
    occurrence: `${segment.name}[${occurrence}]`,
    segmentIndex: segment.index,
    dto: "",
    label: rawFieldLabel(segment.name, fieldNumber, componentNumber),
    note: rawFieldNote(segment.name, fieldNumber),
    required: false,
    value
  };
}

function rawFieldLabel(segmentName, fieldNumber, componentNumber) {
  const suffix = componentNumber ? ` component ${componentNumber}` : "";
  return `${segmentName}-${fieldNumber}${suffix}`;
}

function rawFieldNote(segmentName, fieldNumber) {
  const known = (hl7Knowledge.fields || []).find((field) =>
    field.segment === segmentName && field.field === fieldNumber
  );
  return known?.note || "Field raw trong ban tin.";
}

function getValue(segment, fieldNumber, componentNumber = 0) {
  if (!segment || !fieldNumber) return "";
  let raw;
  if (segment.name === "MSH") {
    if (fieldNumber === 1) raw = "|";
    else raw = segment.fields[fieldNumber - 1] || "";
  } else {
    raw = segment.fields[fieldNumber] || "";
  }
  if (!componentNumber) return raw || "";
  return (raw || "").split("^")[componentNumber - 1] || "";
}

function setValue(fields, segmentName, fieldNumber, value) {
  const index = segmentName === "MSH" ? fieldNumber - 1 : fieldNumber;
  while (fields.length <= index) fields.push("");
  fields[index] = value == null ? "" : String(value);
}

function convertToORU() {
  try {
    const parsed = parseHl7(readInputData());
    const timestamp = hl7Now();
    const output = [];

    const msh = parsed.msh ? [...parsed.msh.fields] : ["MSH", "^~\\&"];
    setValue(msh, "MSH", 7, timestamp);
    setValue(msh, "MSH", 9, "ORU^R01^ORU_R01");
    output.push(msh.join("|"));
    if (parsed.pid) output.push(parsed.pid.raw);
    if (parsed.pv1) output.push(parsed.pv1.raw);

    parsed.orders.forEach((group, index) => {
      const orc = group.orc ? [...group.orc.fields] : ["ORC"];
      const obr = group.obr ? [...group.obr.fields] : ["OBR"];
      const serviceCode = getValue(group.obr, 4, 1) || `PACS${index + 1}`;
      const serviceName = getValue(group.obr, 4, 2) || "Dich vu PACS";

      setValue(orc, "ORC", 1, "SC");
      setValue(orc, "ORC", 15, timestamp);
      setValue(obr, "OBR", 22, timestamp);
      if (!getValue({ name: "OBR", fields: obr }, 2, 1)) setValue(obr, "OBR", 2, String(index + 1));
      if (!getValue({ name: "OBR", fields: obr }, 4, 1)) setValue(obr, "OBR", 4, `${serviceCode}^${serviceName}`);

      output.push(orc.join("|"));
      output.push(obr.join("|"));
      output.push(buildPacsObx(1, "REPORT", `Mo ta demo cho ${serviceName}`, timestamp, "PACS-DEMO"));
      output.push(buildPacsObx(2, "CONCLUSION", "Ket luan demo trong gioi han binh thuong", timestamp, "PACS-DEMO"));
      output.push(buildPacsObx(4, "IMAGE", `https://pacs.example.local/images/${serviceCode}`, timestamp, "PACS-DEMO"));
      output.push(buildPacsObx(5, "WARNING", "", timestamp, "PACS-DEMO"));
    });

    const hl7 = output.join("\r");
    writeOutput(hl7);
    const resultParsed = parseHl7(hl7);
    renderCheckResult(resultParsed, "result", buildCheckResult(resultParsed, "result"));
  } catch (error) {
    renderError(error.message);
  }
}

function buildPacsObx(setId, code, value, timestamp, machine) {
  const fields = ["OBX"];
  setValue(fields, "OBX", 1, setId);
  setValue(fields, "OBX", 2, "TX");
  setValue(fields, "OBX", 3, `${code}^PACS ${code}`);
  setValue(fields, "OBX", 5, value);
  setValue(fields, "OBX", 11, "F");
  setValue(fields, "OBX", 14, timestamp);
  setValue(fields, "OBX", 18, machine);
  return fields.join("|");
}

function generateStatusUpdate() {
  try {
    const parsed = parseHl7(readInputData());
    const statusCode = document.getElementById("statusCode").value;
    const timestamp = hl7Now();
    const output = [];

    const msh = parsed.msh ? [...parsed.msh.fields] : ["MSH", "^~\\&"];
    setValue(msh, "MSH", 7, timestamp);
    if (!getValue({ name: "MSH", fields: msh }, 9)) setValue(msh, "MSH", 9, "OMI^O23^OMI_O23");
    output.push(msh.join("|"));
    if (parsed.pid) output.push(parsed.pid.raw);
    if (parsed.pv1) output.push(parsed.pv1.raw);

    parsed.orders.forEach((group, index) => {
      const orc = group.orc ? [...group.orc.fields] : ["ORC"];
      const obr = group.obr ? [...group.obr.fields] : ["OBR"];
      setValue(orc, "ORC", 1, statusCode);
      setValue(orc, "ORC", 10, getValue(group.orc, 10, 1) || "PACS-USER");
      setValue(orc, "ORC", 15, timestamp);
      setValue(orc, "ORC", 16, timestamp);
      if (!getValue({ name: "OBR", fields: obr }, 2, 1)) setValue(obr, "OBR", 2, String(index + 1));
      if (!getValue({ name: "OBR", fields: obr }, 4, 1)) setValue(obr, "OBR", 4, `PACS${index + 1}^Dich vu PACS`);
      output.push(orc.join("|"));
      if (group.tq1) output.push(group.tq1.raw);
      output.push(obr.join("|"));
    });

    const hl7 = output.join("\r");
    writeOutput(hl7);
    const resultParsed = parseHl7(hl7);
    renderCheckResult(resultParsed, "status", buildCheckResult(resultParsed, "status"));
  } catch (error) {
    renderError(error.message);
  }
}

function writeOutput(hl7) {
  const id = getValue(parseHl7(hl7).msh, 10) || getValue(first(parseHl7(hl7).byName.ORC), 2, 1) || "";
  document.getElementById("outputData").value = JSON.stringify({
    ID: id,
    Hl7Data: hl7,
    Sign: 1234567
  }, null, 2);
}

function copyOutput() {
  const output = document.getElementById("outputData");
  output.select();
  output.setSelectionRange(0, output.value.length);
  document.execCommand("copy");
}

function renderCheckResult(parsed, mode, check) {
  lastRenderState = { parsed, mode, check };
  const definition = hl7Knowledge.messageTypes[mode] || hl7Knowledge.messageTypes.order;
  const errors = check.issues.filter((issue) => issue.level === "error").length;
  const warnings = check.issues.filter((issue) => issue.level === "warn").length;
  const statusClass = errors ? "bad" : warnings ? "warn" : "ok";
  const statusText = errors ? `${errors} loi` : warnings ? `${warnings} canh bao` : "Hop le theo knowledge";
  const searchTerm = document.getElementById("searchInput").value.trim();

  document.getElementById("analysisPanel").innerHTML = `
    <section class="summary ${statusClass}">
      <div>
        <h2>${escapeHtml(definition.label)}</h2>
        <p>${escapeHtml(definition.direction)} - ${escapeHtml(definition.endpoint)}</p>
      </div>
      <strong>${escapeHtml(statusText)}</strong>
    </section>
    <section class="quick-grid">
      ${summaryItem("Loai HL7", getValue(parsed.msh, 9))}
      ${summaryItem("So phieu", getValue(first(parsed.byName.ORC), 2, 1) || getValue(parsed.msh, 10))}
      ${summaryItem("Ma NB", getValue(parsed.pid, 3, 2))}
      ${summaryItem("Ma ho so", getValue(parsed.pid, 3, 1) || getValue(parsed.pv1, 19, 1))}
      ${summaryItem("So order", String(parsed.orders.length))}
      ${summaryItem("Segments", String(parsed.segments.length))}
    </section>
    ${renderIssues(check.issues)}
    ${renderMessageSearch(parsed, searchTerm)}
    <section>
      <h3>DTO Sakura preview</h3>
      <pre>${escapeHtml(JSON.stringify(check.dto, null, 2))}</pre>
    </section>
    <section>
      <h3>Wiki fields</h3>
      ${renderWikiTable(mode, searchTerm)}
    </section>
    <section>
      <h3>Field map theo segment</h3>
      ${renderFieldTable(check.fields, searchTerm)}
    </section>
    <section>
      <h3>Raw fields trong ban tin</h3>
      ${renderFieldTable(check.rawFields, searchTerm, { showDto: false })}
    </section>
  `;
}

function renderWikiOnly() {
  const mode = document.getElementById("messageMode")?.value || "auto";
  const searchTerm = document.getElementById("searchInput")?.value.trim() || "";
  const wikiMode = mode === "auto" ? "all" : mode;

  lastRenderState = null;
  document.getElementById("analysisPanel").innerHTML = `
    <section class="summary">
      <div>
        <h2>Wiki field HL7 PACS</h2>
        <p>Search truc tiep theo segment, field, ten nghiep vu hoac DTO ma khong can parse ban tin.</p>
      </div>
      <strong>${escapeHtml(hl7Knowledge.messageTypes[wikiMode]?.label || "Tat ca luong")}</strong>
    </section>
    <section>
      <h3>Wiki fields</h3>
      ${renderWikiTable(wikiMode, searchTerm)}
    </section>
  `;
}

function renderIssues(issues) {
  if (!issues.length) {
    return `<section><h3>Kiem tra</h3><p class="empty">Khong phat hien loi bat buoc.</p></section>`;
  }
  return `
    <section>
      <h3>Kiem tra</h3>
      <ul class="issues">
        ${issues.map((issue) => `<li class="${issue.level}">${escapeHtml(issue.message)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderMessageSearch(parsed, searchTerm) {
  if (!searchTerm) return "";
  const rawHits = collectRawFields(parsed).filter((field) => fieldMatches(field, searchTerm));
  const rawHitIndexes = new Set(rawHits.map((field) => field.segmentIndex));
  const matchedSegments = parsed.segments.filter((segment) =>
    includesText(segment.raw, searchTerm) || rawHitIndexes.has(segment.index)
  );
  return `
    <section>
      <h3>Tim trong ban tin</h3>
      ${matchedSegments.length
        ? `<div class="segment-list">${matchedSegments.map((segment) => `
            <pre class="segment-hit">${highlightText(segment.raw, searchTerm)}</pre>
          `).join("")}</div>`
        : `<p class="empty muted">Khong thay segment nao khop tu khoa.</p>`}
    </section>
  `;
}

function renderWikiTable(mode, searchTerm = "") {
  const fields = wikiFieldsForMode(mode).map((field) => ({
    ...field,
    displayPath: field.path,
    value: field.example || ""
  }));

  return renderFieldTable(fields, searchTerm, {
    showValue: false,
    emptyText: "Khong co field wiki nao khop tu khoa."
  });
}

function renderFieldTable(fields, searchTerm = "", options = {}) {
  const filteredFields = searchTerm
    ? fields.filter((field) => fieldMatches(field, searchTerm))
    : fields;
  const showDto = options.showDto !== false;
  const showValue = options.showValue !== false;
  const emptyText = options.emptyText || "Khong co field nao khop tu khoa.";

  if (!fields.length) return `<p class="empty">Chua co field map.</p>`;
  if (!filteredFields.length) return `<p class="empty muted">${escapeHtml(emptyText)}</p>`;

  const counter = searchTerm
    ? `<p class="table-count">Tim thay ${filteredFields.length}/${fields.length} field.</p>`
    : "";

  return `
    ${counter}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Path</th>
            ${showDto ? "<th>DTO</th>" : ""}
            ${showValue ? "<th>Gia tri</th>" : ""}
            <th>Ghi chu</th>
          </tr>
        </thead>
        <tbody>
          ${filteredFields.map((field) => `
            <tr class="${field.required && !field.value ? "missing" : ""}">
              <td><code>${highlightText(field.displayPath || field.path, searchTerm)}</code><span>${highlightText(field.path && field.displayPath !== field.path ? `${field.path} - ` : "", searchTerm)}${highlightText(field.label || "", searchTerm)}</span></td>
              ${showDto ? `<td>${highlightText(field.dto || "", searchTerm)}</td>` : ""}
              ${showValue ? `<td>${highlightText(field.value || "", searchTerm)}</td>` : ""}
              <td>${highlightText(field.note || "", searchTerm)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function fieldMatches(field, searchTerm) {
  return [
    field.path,
    field.displayPath,
    field.occurrence,
    field.segment,
    field.dto,
    field.label,
    field.note,
    field.value
  ].some((value) => includesText(value, searchTerm));
}

function includesText(value, searchTerm) {
  return String(value || "").toLowerCase().includes(searchTerm.toLowerCase());
}

function highlightText(value, searchTerm) {
  const text = escapeHtml(value || "");
  if (!searchTerm) return text;

  const escapedTerm = escapeRegExp(escapeHtml(searchTerm));
  return text.replace(new RegExp(escapedTerm, "gi"), (match) => `<mark>${match}</mark>`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summaryItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function renderError(message) {
  document.getElementById("analysisPanel").innerHTML = `
    <section class="summary bad">
      <div>
        <h2>Khong parse duoc</h2>
        <p>${escapeHtml(message)}</p>
      </div>
      <strong>Loi</strong>
    </section>
  `;
}

function normalizeMaNb(value) {
  const raw = String(value || "");
  return raw.startsWith("99") ? raw.slice(2) : raw;
}

function firstNonEmpty(values) {
  return values.find((value) => value) || "";
}

function hl7Now() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
