// ============================================================
// โมดูลคำนวณ: ทรงโค้ง (Curve)
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcCurve(C) {
            document.getElementById('labelLength').innerText = "ความยาวแผ่นตัด (โค้ง)";
            let width = parseFloat(document.getElementById('roofWidth').value) || 0;
            let run = parseFloat(document.getElementById('roofRun').value) || 0;
            let curveVal = parseFloat(document.getElementById('curveValue').value) || 0;
            let isStraightEaves = document.getElementById('straightEaves').checked;

            if(width===0 || run===0 || curveVal===0) { showWarning("⚠️ กรุณากรอกข้อมูลให้ครบ"); return false; }
            
            C.baseWidth = width;

            let h = 0, R = 0;
            if (curveCalcMode === 'h') {
                h = curveVal;
                R = (h/2) + ((run*run) / (8*h));
            } else {
                R = curveVal;
                if(R < run/2) { showWarning("⚠️ รัศมี (R) น้อยเกินไป"); return false; }
                h = R - Math.sqrt((R*R) - ((run/2)*(run/2)));
            }

            let theta = 2 * Math.asin(run / (2*R));
            let arcLen = R * theta;
            
            if (isStraightEaves) {
                let halfTheta = Math.asin((run/2)/R); 
                let straightLen = C.overhang / Math.cos(halfTheta);
                C.totalLen = arcLen + (straightLen * 2);
            } else {
                C.totalLen = arcLen + (C.overhang * 2); 
            }
            
            C.geometricArea = width * C.totalLen;
            C.gableArea = 0.5 * R * R * (theta - Math.sin(theta));

            // ----- ซอยแผ่นตามความยาวโค้ง (พร้อมระยะทับซ้อน) -----
            let pieces = parseInt(document.getElementById('curvePieces').value) || 1;
            if (pieces < 1) pieces = 1;
            let overlapLen = parseFloat(document.getElementById('curveOverlap').value) || 0;
            if (overlapLen < 0) overlapLen = 0;
            let customPieces = document.getElementById('curveCustomLen').checked;

            // ผลรวมวัสดุที่ต้องใช้ต่อ 1 แถว = ความยาวโค้ง + ทับซ้อน × (จำนวนแผ่น - 1)
            let targetSum = C.totalLen + overlapLen * (pieces - 1);
            let pieceLens = [];

            if (pieces > 1) {
                if (customPieces) {
                    // โหมดกำหนดแผ่นหลักเอง: ช่องไหนพิมพ์ = แผ่นหลัก (คงที่)
                    // ช่องที่เว้นว่าง/เส้นประ = ระบบคำนวณแบ่งส่วนที่เหลือให้อัตโนมัติ
                    let vals = [];
                    let autoIdx = [];
                    let fixedSum = 0;
                    for (let i = 1; i <= pieces; i++) {
                        let el = document.getElementById('curvePieceLen' + i);
                        let raw = el ? String(el.value).trim() : '';
                        let isAuto = el && el.dataset.auto === '1';
                        if (raw === '' || isAuto) {
                            vals.push(null);
                            autoIdx.push(i - 1);
                        } else {
                            let v = parseFloat(raw) || 0;
                            vals.push(v);
                            fixedSum += v;
                        }
                    }

                    if (vals.some(v => v !== null && v <= 0)) { showWarning("⚠️ ความยาวแผ่นหลักต้องมากกว่า 0"); return false; }

                    if (autoIdx.length === 0) {
                        // กำหนดครบทุกแผ่นเอง: ผลรวมต้องครบพอดี
                        if (Math.abs(fixedSum - targetSum) > 0.02) {
                            showWarning(`⚠️ ผลรวมทุกแผ่นต้องเท่ากับ ${targetSum.toFixed(2)} ม. (โค้ง ${C.totalLen.toFixed(2)} + ทับซ้อน ${(overlapLen * (pieces - 1)).toFixed(2)}) ตอนนี้ได้ ${fixedSum.toFixed(2)} ม.`);
                            return false;
                        }
                        pieceLens = vals;
                    } else {
                        // แผ่นที่เหลือคำนวณอัตโนมัติจากส่วนที่เหลือ
                        let remaining = targetSum - fixedSum;
                        if (remaining <= 0) {
                            showWarning(`⚠️ แผ่นหลักรวม ${fixedSum.toFixed(2)} ม. เกินวัสดุที่ต้องใช้ ${targetSum.toFixed(2)} ม. (โค้ง ${C.totalLen.toFixed(2)} + ทับซ้อน)`);
                            return false;
                        }
                        let autoLen = remaining / autoIdx.length;
                        pieceLens = vals.slice();
                        autoIdx.forEach(idx => { pieceLens[idx] = autoLen; });

                        // เติมค่าอัตโนมัติกลับเข้าช่อง (ทำเครื่องหมายเส้นประไว้)
                        for (let i = 1; i <= pieces; i++) {
                            let el = document.getElementById('curvePieceLen' + i);
                            if (!el) continue;
                            if (vals[i - 1] === null) {
                                el.value = autoLen.toFixed(2);
                                el.dataset.auto = '1';
                                el.classList.add('curve-piece-auto');
                            } else {
                                el.dataset.auto = '';
                                el.classList.remove('curve-piece-auto');
                            }
                        }
                    }
                } else {
                    // โหมดซอยเท่าๆ กัน
                    let each = targetSum / pieces;
                    for (let i = 0; i < pieces; i++) pieceLens.push(each);
                }
            }

            let materialLen = (pieces > 1) ? targetSum : C.totalLen;

            C.sheetCount = Math.ceil(width / C.sheetW);
            C.totalLinearMeter = materialLen * C.sheetCount;
            C.billableArea = C.totalLinearMeter * C.sheetW;
            C.flashingLen = C.totalLen * 2; // Sides only

            drawCurve(run, h, C.overhang, C.totalLen, R, isStraightEaves, pieceLens, overlapLen);

            let typeText = isStraightEaves ? "ทรงโค้ง (ชายคาตรง)" : "ทรงโค้ง (Curved)";
            if (pieces > 1) typeText += ` (ซอย ${pieces} แผ่น)`;
            document.getElementById('print-type').innerText = typeText;
            document.getElementById('print-slope-h').innerText = `H=${h.toFixed(2)}m / R=${R.toFixed(2)}m`;
            document.getElementById('print-width').innerText = width;
            document.getElementById('print-run').innerText = run;
            document.getElementById('curveGableRow').style.display = 'block';
            document.getElementById('outGableArea').innerText = C.gableArea.toFixed(2);

            if (pieces > 1) {
                document.getElementById('labelLength').innerText = "ความยาวโค้งรวม (ก่อนซอย)";
            }
            document.getElementById('outLength').innerText = C.totalLen.toFixed(2) + " ม.";

            // --- รายการซอยแผ่น (Cutting List) ---
            if (pieces > 1) {
                let tbody = document.getElementById('sheetListBody');
                tbody.innerHTML = "";
                let pos = 0;
                for (let i = 0; i < pieces; i++) {
                    let start = (i === 0) ? 0 : pos - overlapLen;
                    let end = start + pieceLens[i];
                    pos = end;
                    tbody.innerHTML += `<tr>
                        <td>แผ่นที่ ${i + 1}</td>
                        <td>${start.toFixed(2)} - ${end.toFixed(2)}</td>
                        <td style="font-weight:bold; color:var(--primary-color);">${pieceLens[i].toFixed(2)}</td>
                    </tr>`;
                }
                document.getElementById('cuttingSheetList').style.display = 'block';
                document.getElementById('cutListDesc').innerText = `(ซอย ${pieces} แผ่น ทับซ้อนจุดละ ${overlapLen.toFixed(2)} ม. รวมวัสดุ ${targetSum.toFixed(2)} ม./แถว)`;

                let formulaHtml = `
                    <div class="formula-line"><span>1. ความยาวโค้งรวม:</span> <span class="formula-val">${C.totalLen.toFixed(2)} ม.</span></div>
                    <div class="formula-line"><span>2. ระยะทับซ้อน (${pieces - 1} จุด):</span> <span class="formula-val">${overlapLen.toFixed(2)} × ${pieces - 1} = ${(overlapLen * (pieces - 1)).toFixed(2)} ม.</span></div>
                    <div class="formula-line"><span>3. วัสดุรวมต่อ 1 แถว:</span> <span class="formula-val">${C.totalLen.toFixed(2)} + ${(overlapLen * (pieces - 1)).toFixed(2)} = ${targetSum.toFixed(2)} ม.</span></div>
                    <div class="formula-line"><span>4. พื้นที่ขาย (Billable):</span> <span class="formula-val">${targetSum.toFixed(2)} × ${C.sheetCount} แผ่น × หน้ากว้าง ${C.sheetW} = ${C.billableArea.toFixed(2)} ตร.ม.</span></div>
                `;
                document.getElementById('formulaContent').innerHTML = formulaHtml;
                document.getElementById('cuttingFormula').style.display = 'block';
            }
    return true;
}
