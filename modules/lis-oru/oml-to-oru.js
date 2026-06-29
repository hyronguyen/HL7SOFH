const DEFAULT_KNOWLEDGE = {
  source: {
    project: "Sakura LIS",
    notes: ["Fallback knowledge. Mo qua local server de load day du file hl7-knowledge.json."]
  },
  messageTypes: {
    order: {
      label: "Ban tin gui chi dinh",
      endpoint: "GET /lis/chi-dinh",
      hl7: "OML^O21^OML_O21",
      direction: "HIS -> LIS",
      requiredSegments: ["MSH", "PID", "PV1", "ORC", "OBR"]
    },
    status: {
      label: "Ban tin cap nhat trang thai",
      endpoint: "POST /lis/trang-thai",
      hl7: "OML^O21^OML_O21",
      direction: "LIS -> HIS",
      requiredSegments: ["MSH", "PID", "PV1", "ORC", "OBR"]
    },
    result: {
      label: "Ban tin tra ket qua",
      endpoint: "POST /lis/ket-qua",
      hl7: "ORU^R01^ORU_R01",
      direction: "LIS -> HIS",
      requiredSegments: ["MSH", "PID", "PV1", "ORC", "OBR", "OBX"]
    }
  },
  statusMap: {
    NW: { hisStatus: "CHO_TIEP_NHAN", note: "Cho tiep nhan" },
    OK: { hisStatus: "CHUAN_BI_LAY_MAU", note: "Chuan bi lay mau" },
    OE: { hisStatus: "DA_TIEP_NHAN_MAU", note: "Da tiep nhan mau" },
    OR: { hisStatus: "DA_LAY_MAU", note: "Da lay mau" },
    DC: { hisStatus: "HUY_MAU", note: "Huy mau" }
  },
  resultFlagMap: {
    N: { hisValue: "BINH_THUONG", note: "Binh thuong" },
    L: { hisValue: "THAP", note: "Thap" },
    H: { hisValue: "CAO", note: "Cao" },
    C: { hisValue: "BAT_THUONG", note: "Bat thuong" }
  },
  fields: [
    { message: "common", segment: "MSH", field: 9, component: 0, path: "MSH-9", dto: "messageType", label: "Loai ban tin", required: true },
    { message: "common", segment: "MSH", field: 10, component: 0, path: "MSH-10", dto: "soPhieu", label: "So phieu", required: true },
    { message: "common", segment: "PID", field: 3, component: 1, path: "PID-3.1", dto: "maNb", label: "Ma nguoi benh", required: true },
    { message: "common", segment: "PV1", field: 19, component: 1, path: "PV1-19.1", dto: "maHoSo", label: "Ma ho so", required: true },
    { message: "common", segment: "OBR", field: 2, component: 1, path: "OBR-2.1", dto: "id/chiSoConId", label: "ID ket noi HIS", required: true },
    { message: "status", segment: "ORC", field: 1, component: 1, path: "ORC-1.1", dto: "trangThai", label: "Ma trang thai LIS", required: true },
    { message: "status", segment: "OBR", field: 4, component: 1, path: "OBR-4.1", dto: "maKetNoi", label: "Ma ket noi dich vu", required: true },
    { message: "result", segment: "OBX", field: 5, component: 1, path: "OBX-5.1", dto: "ketQua", label: "Ket qua", required: true },
    { message: "result", segment: "OBX", field: 14, component: 1, path: "OBX-14.1", dto: "thoiGianCoKetQua", label: "Thoi gian co ket qua", required: true }
  ]
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
    const response = await fetch("./hl7-knowledge.json", { cache: "no-store" });
    if (response.ok) {
      hl7Knowledge = await response.json();
    }
  } catch (error) {
    console.warn("Cannot load hl7-knowledge.json, using fallback knowledge.", error);
  }
}

function bindControls() {
  document.getElementById("checkBtn").addEventListener("click", checkMessage);
  document.getElementById("demoResultBtn").addEventListener("click", convertOMLtoORU);
  document.getElementById("demoStatusBtn").addEventListener("click", generateStatusUpdate);
  document.getElementById("copyBtn").addEventListener("click", copyOutput);
  document.getElementById("messageMode").addEventListener("change", checkMessage);
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
  if (!rawValue) {
    throw new Error("Chua co du lieu dau vao.");
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed.data === "string") return parsed.data;
  } catch (ignore) {
    return rawValue;
  }

  throw new Error('Dau vao JSON can co field "data" dang chuoi HL7.');
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
    return {
      index,
      raw: line,
      name: fields[0],
      fields
    };
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
      current = { orc: segment, obr: null, obx: [], nte: [], spm: null, tq1: null };
      groups.push(current);
      continue;
    }

    if (segment.name === "OBR") {
      if (!current || current.obr) {
        current = { orc: looseOrc, obr: null, obx: [], nte: [], spm: null, tq1: null };
        groups.push(current);
      }
      current.obr = segment;
      continue;
    }

    if (!current) continue;

    if (segment.name === "OBX") current.obx.push(segment);
    if (segment.name === "NTE") current.nte.push(segment);
    if (segment.name === "SPM") current.spm = segment;
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
  if (msh9.includes("OML^O21")) {
    const hasResultData = parsed.byName.OBX && parsed.byName.OBX.length > 0;
    if (hasResultData) return "result";
    const orderControl = getValue(first(parsed.byName.ORC), 1);
    if (["OE", "OR", "OK", "DC"].includes(orderControl)) return "status";
    return "order";
  }
  return "order";
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
      issues.push({
        level: "error",
        message: `Thieu segment bat buoc ${segmentName}.`
      });
    }
  }

  if (mode === "status") {
    parsed.orders.forEach((group, index) => {
      const orderControl = getValue(group.orc, 1);
      if (!orderControl) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu ORC-1 de map trang thai.` });
      } else if (!hl7Knowledge.statusMap[orderControl]) {
        issues.push({ level: "error", message: `Order ${index + 1}: ORC-1=${orderControl} chua duoc Sakura map.` });
      }
      if (!getValue(group.obr, 2)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-2 id ket noi HIS.` });
      }
      if (!getValue(group.obr, 4)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-4 ma ket noi dich vu.` });
      }
    });
  }

  if (mode === "result") {
    parsed.orders.forEach((group, index) => {
      const obx = first(group.obx);
      if (!obx) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBX ket qua.` });
        return;
      }
      if (!getValue(group.obr, 2)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-2 id ket noi HIS.` });
      }
      if (!getValue(group.obr, 4, 1)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBR-4.1 ma chi so/ma ket noi.` });
      }
      if (!getValue(obx, 5)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBX-5 ket qua.` });
      }
      if (!getValue(obx, 14)) {
        issues.push({ level: "error", message: `Order ${index + 1}: thieu OBX-14 thoi gian co ket qua, ban tin ket qua co the bi tu choi.` });
      }
      const flag = getValue(obx, 8);
      if (flag && !hl7Knowledge.resultFlagMap[flag]) {
        issues.push({ level: "warn", message: `Order ${index + 1}: OBX-8=${flag} khong nam trong map N/L/H/C.` });
      }
    });
  }

  if (!getValue(parsed.msh, 10)) {
    issues.push({ level: "error", message: "Thieu MSH-10 soPhieu, khong du thong tin de tim phieu xet nghiem." });
  }
  if (!getValue(parsed.pv1, 19, 1)) {
    issues.push({ level: "error", message: "Thieu PV1-19.1 maHoSo. Sakura doi chieu voi soPhieu." });
  }
  if (!getValue(parsed.pid, 3, 1)) {
    issues.push({ level: "warn", message: "Thieu PID-3.1 maNb." });
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
    maHoSo: getValue(parsed.pv1, 19, 1),
    maNb: getValue(parsed.pid, 3, 1),
    soPhieu: getValue(parsed.msh, 10),
    dsDichVu: []
  };

  parsed.orders.forEach((group) => {
    const identifier = splitIdentifier(getValue(group.obr, 2, 1));
    const obx = first(group.obx);
    const item = {
      id: identifier.id,
      chiSoConId: identifier.chiSoConId,
      maKetNoi: getValue(group.obr, 4, 1),
      sid: getValue(group.obr, 18, 1)
    };

    if (mode === "status") {
      const statusCode = getValue(group.orc, 1, 1);
      item.trangThai2 = statusCode;
      item.trangThai = hl7Knowledge.statusMap[statusCode]?.hisStatus || null;
      item.thoiGianLayMau = getValue(group.orc, 15, 1) || getValue(group.orc, 9, 1);
      item.maNguoiLayMau = getValue(group.orc, 19, 1);
      item.thoiGianTiepNhanMau = getValue(group.orc, 15, 1);
      item.maNguoiTiepNhan = getValue(group.orc, 22, 1);
    }

    if (mode === "result") {
      const flag = getValue(obx, 8, 1);
      item.maChiSoCon = getValue(group.obr, 4, 1);
      item.tenChiSoCon = getValue(group.obr, 4, 2);
      item.maDvCha = getValue(group.obr, 4, 4);
      item.maMay = getValue(obx, 18, 1);
      item.maBacSi = getValue(obx, 16, 1);
      item.ketQua = getValue(obx, 5, 1);
      item.ketQuaThamChieu = getValue(obx, 7, 1);
      item.trangThaiKq = hl7Knowledge.resultFlagMap[flag]?.hisValue || null;
      item.donVi = getValue(obx, 6, 2) || getValue(obx, 6, 1);
      item.thoiGianCoKetQua = getValue(obx, 14, 1);
      item.maNguoiThucHien = getValue(group.obr, 19, 1);
      item.ghiChu = getValue(first(group.nte), 3, 1);
      item.maQuyTrinh = getValue(group.obr, 24, 1);
      item.phuongPhap = getValue(obx, 17, 2);
      item.canhBao = getValue(obx, 17, 4);
      item.loaiBenhPham = getValue(group.spm, 4, 2);
      item.soGpb = getValue(group.obr, 39, 1);
    }

    dto.dsDichVu.push(item);
  });

  return dto;
}

function collectFields(parsed, mode) {
  return wikiFieldsForMode(mode).flatMap((field) => {
    const segments = segmentsForField(parsed, field.segment);

    if (!segments.length) {
      return [{
        ...field,
        displayPath: field.path,
        occurrence: "",
        value: ""
      }];
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
  if (mode === "all") {
    return hl7Knowledge.fields || [];
  }

  return (hl7Knowledge.fields || [])
    .filter((field) => field.message === "common" || field.message === mode);
}

function segmentsForField(parsed, segmentName) {
  if (segmentName === "OBX") {
    return parsed.orders.flatMap((group) => group.obx);
  }

  if (["ORC", "OBR", "SPM", "TQ1"].includes(segmentName)) {
    return parsed.orders
      .map((group) => group[segmentName.toLowerCase()])
      .filter(Boolean);
  }

  if (segmentName === "NTE") {
    return parsed.orders.flatMap((group) => group.nte);
  }

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

    if (segment.name === "MSH") {
      rows.push(rawFieldRow(segment, occurrence, 1, 0, "|"));
    }

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

function setComponent(fields, segmentName, fieldNumber, componentNumber, value) {
  const index = segmentName === "MSH" ? fieldNumber - 1 : fieldNumber;
  while (fields.length <= index) fields.push("");
  const components = String(fields[index] || "").split("^");
  while (components.length < componentNumber) components.push("");
  components[componentNumber - 1] = value == null ? "" : String(value);
  fields[index] = components.join("^");
}

function splitIdentifier(value) {
  const [id, chiSoConId] = String(value || "").split("-");
  return {
    id: id || null,
    chiSoConId: chiSoConId || null
  };
}

function convertOMLtoORU() {
  try {
    const parsed = parseHl7(readInputData());
    const timestamp = getValue(parsed.msh, 7) || hl7Now();
    const output = [];

    const msh = [...parsed.msh.fields];
    setValue(msh, "MSH", 9, "ORU^R01^ORU_R01");
    output.push(msh.join("|"));
    if (parsed.pid) output.push(parsed.pid.raw);
    if (parsed.pv1) output.push(parsed.pv1.raw);

    parsed.orders.forEach((group, index) => {
      const orc = group.orc ? [...group.orc.fields] : ["ORC"];
      const obr = group.obr ? [...group.obr.fields] : ["OBR"];
      const serviceCode = getValue(group.obr, 4, 1) || `XN${index + 1}`;
      const serviceName = getValue(group.obr, 4, 2) || "Xet nghiem";
      const value = serviceCode.toUpperCase().includes("PCR") ? "Am tinh" : (4 + index * 1.3).toFixed(1);
      const isNumber = !Number.isNaN(Number(value));
      const unit = isNumber ? "^mmol/L" : "";

      setValue(orc, "ORC", 1, "SC");
      setValue(orc, "ORC", 15, timestamp);
      setValue(obr, "OBR", 4, `${serviceCode}^${serviceName}^^${getValue(group.obr, 4, 1)}`);

      output.push(orc.join("|"));
      output.push(obr.join("|"));
      if (group.spm) output.push(group.spm.raw);
      output.push(buildObx(index + 1, isNumber ? "NM" : "ST", serviceCode, serviceName, value, unit, isNumber ? "2.5-7.5" : "", "N", timestamp));
      output.push(`NTE|${index + 1}||Demo ket qua tu tool LIS ORU`);
    });

    writeOutput(output.join("\r"));
    renderCheckResult(parseHl7(output.join("\r")), "result", buildCheckResult(parseHl7(output.join("\r")), "result"));
  } catch (error) {
    renderError(error.message);
  }
}

function buildObx(setId, valueType, code, name, value, unit, refRange, flag, timestamp) {
  const fields = ["OBX"];
  setValue(fields, "OBX", 1, setId);
  setValue(fields, "OBX", 2, valueType);
  setValue(fields, "OBX", 3, `${code}^${name}`);
  setValue(fields, "OBX", 5, value);
  setValue(fields, "OBX", 6, unit);
  setValue(fields, "OBX", 7, refRange);
  setValue(fields, "OBX", 8, flag);
  setValue(fields, "OBX", 11, "F");
  setValue(fields, "OBX", 14, timestamp);
  setValue(fields, "OBX", 16, "SYSTEM^LIS Demo");
  setValue(fields, "OBX", 17, "^Demo method^^");
  setValue(fields, "OBX", 18, "LIS-DEMO");
  return fields.join("|");
}

function generateStatusUpdate() {
  try {
    const parsed = parseHl7(readInputData());
    const statusCode = document.getElementById("statusCode").value;
    const timestamp = hl7Now();
    const output = [];

    if (parsed.msh) output.push(parsed.msh.raw);
    if (parsed.pid) output.push(parsed.pid.raw);
    if (parsed.pv1) output.push(parsed.pv1.raw);

    parsed.orders.forEach((group, index) => {
      const orc = group.orc ? [...group.orc.fields] : ["ORC"];
      const obr = group.obr ? [...group.obr.fields] : ["OBR"];
      setValue(orc, "ORC", 1, statusCode);
      setValue(orc, "ORC", 15, timestamp);
      setValue(orc, "ORC", 19, getValue(orcSegment(group), 19) || "tester");
      setValue(orc, "ORC", 22, getValue(orcSegment(group), 22) || "tester");
      if (!getValue({ name: "OBR", fields: obr }, 18)) {
        setValue(obr, "OBR", 18, `SID${String(index + 1).padStart(4, "0")}`);
      }
      output.push(orc.join("|"));
      output.push(obr.join("|"));
      if (group.spm) output.push(group.spm.raw);
      if (group.tq1) output.push(group.tq1.raw);
    });

    writeOutput(output.join("\r"));
    renderCheckResult(parseHl7(output.join("\r")), "status", buildCheckResult(parseHl7(output.join("\r")), "status"));
  } catch (error) {
    renderError(error.message);
  }
}

function orcSegment(group) {
  return group.orc || { name: "ORC", fields: ["ORC"] };
}

function writeOutput(hl7) {
  document.getElementById("outputData").value = JSON.stringify({ data: hl7 }, null, 2);
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
      ${summaryItem("So phieu", getValue(parsed.msh, 10))}
      ${summaryItem("Ma NB", getValue(parsed.pid, 3, 1))}
      ${summaryItem("Ma ho so", getValue(parsed.pv1, 19, 1))}
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
        <h2>Wiki field HL7 LIS</h2>
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
  const matchedSegments = parsed.segments.filter((segment) => includesText(segment.raw, searchTerm));
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
              <td><code>${highlightText(field.displayPath || field.path, searchTerm)}</code><span>${highlightText(field.path && field.displayPath !== field.path ? field.path + " - " : "", searchTerm)}${highlightText(field.label || "", searchTerm)}</span></td>
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
