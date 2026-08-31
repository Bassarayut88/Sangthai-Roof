// ============================================================
// โมดูลสรุปผลรวม: สกรู / คอนเนคเตอร์ / ราคา / ข้อมูลสำหรับพิมพ์
// ถูกเรียกโดย calculate() หลังโมดูลคำนวณของแต่ละทรงทำงานสำเร็จ
// ============================================================

function finalizeCalculation(C) {
        // --- FINAL CALCULATIONS (Screws & Connectors) for Standard Roof ---
        let totalPrice = C.totalLinearMeter * C.price;
        
        if (currentMode !== 'louver') {
            document.getElementById('roof-accessories').style.display = 'block';
            document.getElementById('louver-accessories').style.display = 'none';
            document.getElementById('areaCard').style.display = 'block';
            document.getElementById('resultGrid').style.gridTemplateColumns = '1fr 1fr 1fr';
            
            document.getElementById('print-roof-only-row').style.display = 'table-row';
            document.getElementById('print-louver-only-row').style.display = 'none';
            document.getElementById('print-flashing-label').style.display = 'none';
            document.getElementById('print-flashing-type').innerText = "";
            document.getElementById('print-model').innerText = C.profileName;

            document.getElementById('cuttingTableHead').innerHTML = `
                <tr>
                    <th>แผ่นที่</th>
                    <th>ระยะ (ม.)</th>
                    <th>ความยาวตัด (ม.)</th>
                </tr>
            `;

            let mainScrews = 0;
            let flashScrews = 0;
            let connectorCount = 0;
            let connectorsPerSheet = 0;
            
            let maxLen = 0;
            if (C.sheetData && C.sheetData.length > 0) {
                maxLen = Math.max(...C.sheetData.map(s => s.len));
            } else {
                maxLen = C.totalLen;
            }

            if (C.isKL) {
                if (C.sheetData && C.sheetData.length > 0) {
                    // ตอนนี้ C.purlinSpacing ดึงค่ามาคำนวณได้อย่างถูกต้องแล้ว จะไม่เกิดค่า NaN
                    connectorCount = C.sheetData.reduce((sum, sheet) => sum + (Math.ceil(sheet.len / C.purlinSpacing) + 1), 0);
                    connectorsPerSheet = Math.ceil(maxLen / C.purlinSpacing) + 1; 
                } else {
                    connectorsPerSheet = Math.ceil(maxLen / C.purlinSpacing) + 1;
                    connectorCount = connectorsPerSheet * C.sheetCount;
                }

                let perimeter = (C.baseWidth * 2) + (maxLen * 2);
                if (currentMode === 'polygon' || currentMode === 'irregular' || currentMode === 'triangle' || currentMode === 'rightTri' || currentMode === 'trapezoid') {
                     perimeter = (C.baseWidth * 2) + (maxLen * 2); 
                }

                mainScrews = Math.ceil(perimeter * 3); 
                let baseFlashScrews = Math.ceil(C.flashingLen * 3.5);
                flashScrews = (connectorCount * 4) + baseFlashScrews;
                
                document.getElementById('lblScrewFlash').innerText = "สกรูยึดครอบ/คอนเนคเตอร์ (สั้น):";
                document.getElementById('screwMainDetail').innerText = `(คิดจากเส้นรอบรูป ${perimeter.toFixed(2)} ม. x 3 ตัว/ม.)`;
                document.getElementById('screwFlashDetail').innerText = `(ยึดคอนเนคเตอร์ ${connectorCount*4} ตัว + ยึดครอบ ${baseFlashScrews} ตัว)`;
            } else {
                mainScrews = Math.ceil(C.billableArea * 4); 
                flashScrews = Math.ceil(C.flashingLen * 3.5);
                
                document.getElementById('lblScrewFlash').innerText = "สกรูยึดครอบ (สั้น):";
                document.getElementById('screwMainDetail').innerText = `(รวมความยาว ${C.totalLinearMeter.toFixed(2)} ม.)`;
                document.getElementById('screwFlashDetail').innerText = ``; 
            }

            document.getElementById('outAreaBillable').innerText = C.billableArea.toFixed(2);
            document.getElementById('outAreaReal').innerText = C.geometricArea.toFixed(2);
            document.getElementById('outScrewMain').innerText = mainScrews;
            document.getElementById('outScrewFlash').innerText = flashScrews;
            document.getElementById('outFlash').innerText = C.flashingLen.toFixed(2);
            
            if (C.isKL) {
                document.getElementById('connectorRow').style.display = 'list-item';
                document.getElementById('outConnector').innerText = connectorCount;
                if (C.sheetData && C.sheetData.length > 0) {
                    document.getElementById('connectorDetail').innerText = `(รวมจากทุกแผ่นตัด)`;
                } else {
                    document.getElementById('connectorDetail').innerText = `(ตกแผ่นละ ${connectorsPerSheet} ตัว)`;
                }
            } else {
                document.getElementById('connectorRow').style.display = 'none';
            }
            
            if(currentMode !== 'trapezoid' && currentMode !== 'triangle' && currentMode !== 'rightTri' && currentMode !== 'irregular' && currentMode !== 'polygon' && currentMode !== 'curve') {
                document.getElementById('print-width').innerText = document.getElementById('roofWidth').value;
                document.getElementById('print-run').innerText = document.getElementById('roofRun').value;
            }
            document.getElementById('print-overhang').innerText = C.overhang;
        }

        // Shared UI Updates
        document.getElementById('resultGrid').style.display = 'grid';
        document.getElementById('accessoryList').style.display = 'block';
        document.getElementById('outCount').innerText = C.sheetCount + " แผ่น";
        
        if(C.price > 0) {
            document.getElementById('priceRow').style.display = 'flex';
            document.getElementById('outPrice').innerText = totalPrice.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " บาท";
        } else {
            document.getElementById('priceRow').style.display = 'none';
        }

        document.getElementById('print-uprice').innerText = C.price > 0 ? C.price : "-";
        const now = new Date();
        document.getElementById('print-date').innerText = now.toLocaleDateString('th-TH');
        document.getElementById('print-time').innerText = now.toLocaleTimeString('th-TH');

        calcData.calculated = true;
}
