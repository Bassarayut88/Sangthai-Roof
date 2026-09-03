// ============================================================
// โมดูลคำนวณ: บานเกล็ด (Louver)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcLouver(C) {
            document.getElementById('labelLength').innerText = "ความยาวแผ่นรวมทั้งหมด";
            let width = parseFloat(document.getElementById('louverWidth').value) || 0;
            let height = parseFloat(document.getElementById('louverHeight').value) || 0;
            let spacing = parseFloat(document.getElementById('louverStrapSpacing').value) || 1.0;
            let flashingType = document.getElementById('louverFlashingType').value;
            
            let typeSelect = document.getElementById('louverTypeModel');
            let typeVal = typeSelect.value;
            let typeName = typeSelect.options[typeSelect.selectedIndex].text.split('(')[0].trim();

            if(width === 0 || height === 0) { showWarning("⚠️ กรุณากรอกความกว้างและความสูงช่องเปิดให้ครบถ้วน"); return false; }
            if(spacing <= 0) { showWarning("⚠️ ระยะ @ ขารับบานเกล็ด ต้องมากกว่า 0"); return false; }

            // เช็คว่าเป็นการกำหนดแผ่นเองหรือใช้ค่ามาตรฐาน
            let density = 0;
            if (typeVal.startsWith("custom")) {
                density = parseFloat(document.getElementById('customLouverDensity').value) || 0;
                if (density <= 0) {
                    showWarning("⚠️ กรุณาระบุจำนวนแผ่นต่อเมตรให้ถูกต้อง (มากกว่า 0)");
                    return false;
                }
                typeName = `บานเกล็ดสั่งผลิตพิเศษ (${density} แผ่น/เมตร)`;
            } else {
                const parts = typeVal.split("|");
                density = parseFloat(parts[1]);
            }

            let rows = Math.ceil(height * density); 

            // ----- เพิ่มตรรกะทาบต่อ 20 ซม. หากเกิน 6 เมตร -----
            let cutLengths = [];
            let remaining = width;
            let overlap = 0.20; // ระยะทาบต่อ 20 ซม. (0.20 เมตร)
            
            while(remaining > 0.001) { 
                if (remaining > 6) { 
                    cutLengths.push(6); 
                    remaining -= (6 - overlap); // หักออก 6 เมตร แต่บวกคืน 0.2 เมตร เพื่อใช้ทาบ
                }
                else { 
                    cutLengths.push(remaining); 
                    remaining = 0; 
                }
            }
            
            // คำนวณความยาวรวมที่รวมระยะทาบต่อแล้ว
            let materialLenPerRow = cutLengths.reduce((a, b) => a + b, 0);
            C.totalLen = materialLenPerRow * rows;
            // ---------------------------------------------

            let totalStraps = Math.ceil((C.totalLen / spacing) * 2);
            let totalScrews = totalStraps * 2;
            let numPostsExact = Math.ceil(width / spacing) + 1;
            C.flashingLen = 0;
            let flashingDesc = "";

            if (flashingType === 'perimeter') {
                C.flashingLen = (width * 2) + (height * 2);
                flashingDesc = `เส้นรอบรูป (กว้าง ${width.toFixed(2)}x2 + สูง ${height.toFixed(2)}x2)`;
            } else if (flashingType === 'vertical') {
                C.flashingLen = numPostsExact * height;
                flashingDesc = `ตามระยะ @ (จำนวน ${numPostsExact} เสา x สูง ${height.toFixed(2)})`;
            } else if (flashingType === 'both') {
                C.flashingLen = (width * 2) + (numPostsExact * height);
                flashingDesc = `เส้นรอบรูป + ตามระยะ @ (กว้าง ${width.toFixed(2)}x2 + เสา ${numPostsExact} ต้นxสูง ${height.toFixed(2)})`;
            }

            C.sheetCount = cutLengths.length * rows;
            C.totalLinearMeter = C.totalLen;
            
            // Set Louver specific UI
            document.getElementById('roof-accessories').style.display = 'none';
            document.getElementById('louver-accessories').style.display = 'block';
            document.getElementById('areaCard').style.display = 'none';
            document.getElementById('resultGrid').style.gridTemplateColumns = '1fr 1fr';

            document.getElementById('print-roof-only-row').style.display = 'none';
            document.getElementById('print-louver-only-row').style.display = 'table-row';
            document.getElementById('print-flashing-label').style.display = 'inline';

            document.getElementById('outLouverStraps').innerText = totalStraps.toLocaleString();
            document.getElementById('louverStrapDetail').innerText = `สูตร: (ความยาวรวม ${C.totalLen.toFixed(2)} / ระยะ@ ${spacing.toFixed(2)}) × 2`;
            document.getElementById('outLouverScrews').innerText = totalScrews.toLocaleString();

            if (flashingType === 'none') {
                document.getElementById('louverFlashingRow').style.display = 'none';
                document.getElementById('louverFlashingScrewRow').style.display = 'none';
                document.getElementById('print-flashing-type').innerText = "-";
            } else {
                document.getElementById('louverFlashingRow').style.display = 'list-item';
                document.getElementById('louverFlashingScrewRow').style.display = 'list-item';
                document.getElementById('outLouverFlashing').innerText = C.flashingLen.toFixed(2);
                document.getElementById('louverFlashingDetail').innerText = `รูปแบบ: ${flashingDesc}`;
                let flashScrews = Math.ceil(C.flashingLen * 3.5);
                document.getElementById('outLouverFlashingScrews').innerText = flashScrews.toLocaleString();
                let printFlashTxt = document.getElementById('louverFlashingType').options[document.getElementById('louverFlashingType').selectedIndex].text;
                document.getElementById('print-flashing-type').innerText = printFlashTxt + ` (${C.flashingLen.toFixed(2)} ม.)`;
            }

            let tbody = document.getElementById('sheetListBody');
            tbody.innerHTML = "";
            let cutCounts = {};
            cutLengths.forEach(len => {
                let key = len.toFixed(2);
                cutCounts[key] = (cutCounts[key] || 0) + 1;
            });

            document.getElementById('cuttingSheetList').style.display = 'block';
            document.getElementById('cutListDesc').innerText = `จำนวน ${rows} แถว`;
            document.getElementById('cuttingTableHead').innerHTML = `
                <tr>
                    <th>ความยาวแผ่น (ม.)</th>
                    <th>จำนวนต่อ 1 แถว</th>
                    <th>จำนวนรวมทั้งหมด (แผ่น)</th>
                </tr>
            `;

            for (let lenStr in cutCounts) {
                let countPerRow = cutCounts[lenStr];
                let totalCountForThisLen = countPerRow * rows;
                let rowHTML = `<tr>
                    <td style="font-weight:bold;">${lenStr}</td>
                    <td>${countPerRow}</td>
                    <td style="color:var(--primary-color); font-weight:bold;">${totalCountForThisLen}</td>
                </tr>`;
                tbody.innerHTML += rowHTML;
            }

            drawLouverBox(width, height, spacing, rows, flashingType);

            document.getElementById('print-type').innerText = "บานเกล็ด (Louver)";
            document.getElementById('print-model').innerText = typeName;
            document.getElementById('print-width').innerText = width.toFixed(2) + " (กว้าง)";
            document.getElementById('print-run').innerText = height.toFixed(2) + " (สูง)";
            document.getElementById('print-spacing').innerText = spacing.toFixed(2);
            document.getElementById('print-rows').innerText = rows;
            document.getElementById('outLength').innerText = C.totalLen.toFixed(2) + " ม.";
    return true;
}
