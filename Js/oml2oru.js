// Function to convert OML to ORU format
function convertOMLtoORU() {
      try {
        const input = JSON.parse(document.getElementById("inputData").value.trim());
        const raw = input.data;

        const segments = raw.split("\r");
        const msh = segments.find(s => s.startsWith("MSH"));
        const pid = segments.find(s => s.startsWith("PID"));
        const pv1 = segments.find(s => s.startsWith("PV1"));
        const allORC = segments.filter(s => s.startsWith("ORC"));
        const allOBR = segments.filter(s => s.startsWith("OBR"));

        const timestamp = msh.split("|")[6];
        const msgCtrlId = msh.split("|")[9];
        const mshOut = msh.replace("OML^O21^OML_O21", "ORU^R01^ORU_R01").replace(timestamp, timestamp);

        let output = [mshOut, pid, pv1];

        for (let i = 0; i < allORC.length; i++) {
          const orc = allORC[i];
          const obr = allOBR[i];
          output.push(orc.replace("|OE|", "|SC|"));
          output.push(obr);

          // Sinh OBX giả lập dựa trên mô tả OBR
          const obrFields = obr.split("|");
          const obrId = obrFields[1] || (i + 1).toString();
          const testInfo = obrFields[4] || "UNKNOWN^Xét nghiệm";

          const obxValue = testInfo.includes("PCR") ? "Âm tính" : (Math.random() * 10 + 1).toFixed(1);
          const obxType = isNaN(obxValue) ? "ST" : "NM";
          const unit = isNaN(obxValue) ? "" : (testInfo.includes("ADA") ? "U/L" : "mmol/L");
          const refRange = isNaN(obxValue) ? "" : (testInfo.includes("ADA") ? "0.0-15.0" : "2.5-7.5");

          const obx = `OBX|${i + 1}|${obxType}|${testInfo}||${obxValue}|${unit}|${refRange}|N|||F|||${timestamp}||ISF914^Nguyễn Hồ Ngọc Huy||0`;
          output.push(obx);
        }

        const finalOutput = { data: output.join("\r") };
        updateAnalysis(finalOutput.data);
        document.getElementById("outputData").value = JSON.stringify(finalOutput, null, 2);
      } catch (err) {
        alert("Lỗi xử lý dữ liệu. Vui lòng kiểm tra lại định dạng input.");
        console.error(err);
      }
    }


    //Copy output to clipboard
    function copyOutput() {
      const output = document.getElementById("outputData");
      output.select();
      output.setSelectionRange(0, 99999); // For mobile devices
      document.execCommand("copy");
    }


function updateAnalysis(oruData) {
  const segments = oruData.split("\r");
  let analysis = "";
  let patientName = "", dob = "", gender = "", phone = "", address = "";
  let testCount = 0;

segments.forEach(segment => {
  const fields = segment.split("|");

  switch (fields[0]) {
    case "PID": {
      patientName = (fields[5] || "") + " " + (fields[6] || "");
      dob = formatHL7Date(fields[7] || "");
      gender = fields[8] || "";
      address = fields[11] || "";
      phone = fields[13] || "";

      analysis += `🔹 **THÔNG TIN BỆNH NHÂN** 🔹\n`;
      analysis += `👤 Họ tên      : ${patientName.trim()}\n`;
      analysis += `🗓️  Ngày sinh  : ${dob}\n`;
      analysis += `👩 Giới tính  : ${gender}\n`;
      analysis += `🏠 Địa chỉ    : ${address}\n`;
      analysis += `📞 Điện thoại : ${phone}\n\n`;
      break;
    }

    case "ORC": {
      const orderDate = formatHL7Date(fields[9] || "");
      const doctor = (fields[12] || "").replace("^", " ");
      analysis += `📝 **THÔNG TIN PHIẾU XÉT NGHIỆM**\n`;
      analysis += `📦 Mã phiếu   : ${fields[2] || "?"}\n`;
      analysis += `🕒 Ngày chỉ định: ${orderDate}\n`;
      analysis += `👨‍⚕️ Bác sĩ     : ${doctor}\n\n`;
      break;
    }

    case "OBR": {
      const testName = (fields[4] || "").split("^")[1] || "?";
      analysis += `🧪 === XÉT NGHIỆM ${++testCount} ===\n`;
      analysis += `🔬 Tên: ${testName}\n`;
      break;
    }

    case "OBX": {
      const resultValue = fields[5] || "?";
      const unit = fields[6] || "";
      const refRange = fields[7] || "";
      const interpretation = fields[8] || "N";
      const status = interpretation === "N" ? "✅ Bình thường" : "⚠️ Bất thường";

      analysis += `   • Kết quả         : ${resultValue} ${unit}\n`;
      analysis += `   • Khoảng tham chiếu : ${refRange}\n`;
      analysis += `   • Đánh giá       : ${status}\n\n`;
      break;
    }
  }
});


  document.getElementById("analysisPanel").innerText = analysis.trim();
}

function formatHL7Date(hl7DateStr) {
  if (!hl7DateStr || hl7DateStr.length < 8) return hl7DateStr;

  const yyyy = hl7DateStr.slice(0, 4);
  const mm = hl7DateStr.slice(4, 6);
  const dd = hl7DateStr.slice(6, 8);
  const hh = hl7DateStr.slice(8, 10) || "00";
  const min = hl7DateStr.slice(10, 12) || "00";

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

