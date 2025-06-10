function convertOMLtoORU() {
      const input = document.getElementById("input").value;
      const segments = input.split("\r");

      let msh = segments.find(s => s.startsWith("MSH"));
      let pid = segments.find(s => s.startsWith("PID"));
      let pv1 = segments.find(s => s.startsWith("PV1"));

      // Clone MSH and modify to ORU
      let mshFields = msh.split("|");
      mshFields[8] = "ORU^R01^ORU_R01";
      let newMSH = mshFields.join("|");

      let output = [newMSH, pid, pv1];

      let currentORC = null;
      let obrCount = 0;
      let obxCount = 0;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.startsWith("ORC")) {
          currentORC = seg.replace("|OE|", "|SC|");
        }
        if (seg.startsWith("OBR")) {
          obrCount++;
          obxCount++;
          const obr = seg;

          // Extract order code & name
          const obrFields = obr.split("|");
          const obrCode = obrFields[4] || "NA";
          const obrDesc = obrCode.split("^")[1] || "Xét nghiệm";

          const obx = [
            "OBX",
            obxCount,
            obrDesc.includes("PCR") ? "ST" : "NM",
            obrCode,
            "",
            obrDesc.includes("PCR") ? "Âm tính" : (6.5 + obxCount).toFixed(1),
            obrDesc.includes("PCR") ? "" : "U/L",
            obrDesc.includes("PCR") ? "" : "0.0-15.0",
            "N",
            "",
            "",
            "F",
            "",
            "",
            mshFields[6],
            "",
            "ISF914^Nguyễn Hồ Ngọc Huy",
            "",
            "0"
          ].join("|");

          output.push(currentORC);
          output.push(obr);
          output.push(obx);
        }
      }

      document.getElementById("output").textContent = output.join("\r");
    }