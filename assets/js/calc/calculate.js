// ============================================================
// calculate() — ศูนย์กลางการคำนวณ (Hub)
// ขั้นตอน: เตรียมค่ากลาง (C) → เรียกโมดูลคำนวณตามประเภทหลังคา → finalizeCalculation(C)
// โมดูลคำนวณแต่ละทรงอยู่ในโฟลเดอร์นี้ (calc-*.js) แก้ไขทีละไฟล์ได้โดยไม่กระทบทรงอื่น
// ============================================================

    function calculate() {
        let overhang = parseFloat(document.getElementById('overhang').value) || 0;

        if (currentMode === 'rightTri' || currentMode === 'trapezoid' || currentMode === 'irregular' || currentMode === 'parallelogram' || currentMode === 'polygon' || currentMode === 'louver') {
            overhang = 0;
        }

        let price = parseFloat(document.getElementById('pricePerMeter').value) || 0;
        let angle = parseFloat(document.getElementById('angle').value) || 0;

        let sheetW = 0;
        let isKL = false;
        let profileName = "";
        let purlinSpacing = 0; // ประกาศระดับ Function เพื่อให้โมดูลอื่นใช้ร่วมกันได้

        if (currentMode !== 'louver') {
            let profileSelect = document.getElementById('sheetProfile');
            let profileVal = profileSelect.value;
            profileName = profileSelect.options[profileSelect.selectedIndex].text;

            if(profileVal === "") {
                showWarning("⚠️ กรุณาเลือกรุ่นแผ่นเมทัลชีท");
                return;
            }

            if(profileVal.startsWith("custom")) {
                sheetW = parseFloat(document.getElementById('customVal').value) || 0;
                if(sheetW === 0) {
                    showWarning("⚠️ กรุณาระบุความกว้างแผ่นที่ต้องการ");
                    return;
                }
                profileName = "สั่งผลิตพิเศษ (กว้าง " + sheetW + " ม.)";
            } else {
                const parts = profileVal.split("|");
                sheetW = parseFloat(parts[0]);
                if (parts.length > 2 && (parts[2] === "KL" || parts[2] === "CONN")) {
                    isKL = true;
                }
            }

            purlinSpacing = parseFloat(document.getElementById('purlinSpacing').value) || 0;
            if (isKL && purlinSpacing <= 0) {
                showWarning("⚠️ กรุณาระบุระยะ @ แป ที่ถูกต้อง (มากกว่า 0)");
                return;
            }
        }

        // --- Context กลาง แชร์ค่าให้ทุกโมดูลคำนวณ (อ่าน/เขียนผ่าน C.*) ---
        const rad = angle * (Math.PI / 180);
        const C = {
            overhang, price, angle, sheetW, isKL, profileName, purlinSpacing,
            totalLen: 0, geometricArea: 0, gableArea: 0, sheetCount: 0,
            totalLinearMeter: 0, flashingLen: 0, billableArea: 0,
            sheetData: [], baseWidth: 0,
            rad: rad,
            secVal: 1 / Math.cos(rad)
        };

        // Reset visibility
        document.getElementById('cuttingSheetList').style.display = 'none';
        document.getElementById('cuttingFormula').style.display = 'none';
        document.getElementById('cutListDesc').innerText = "(เรียงจากซ้ายไปขวา)";

        // --- เรียกโมดูลคำนวณตามประเภทหลังคา ---
        let ok = false;
        switch (currentMode) {
            case 'louver':        ok = calcLouver(C); break;
            case 'slope':         ok = calcSlope(C); break;
            case 'rightTri':      ok = calcRightTriangle(C); break;
            case 'curve':         ok = calcCurve(C); break;
            case 'crimpCurve':    ok = calcCrimpCurve(C); break;
            case 'triangle':      ok = calcTriangle(C); break;
            case 'trapezoid':     ok = calcTrapezoid(C); break;
            case 'irregular':     ok = calcIrregular(C); break;
            case 'parallelogram': ok = calcParallelogram(C); break;
            case 'polygon':       ok = calcPolygon(C); break;
            default: return;
        }
        if (!ok) return; // โมดูลแจ้งเตือนข้อมูลไม่ครบแล้ว

        // --- สรุปผลรวม (สกรู / คอนเนคเตอร์ / ราคา / พิมพ์) ---
        finalizeCalculation(C);
    }
