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
            // ----- วิเคราะห์การดัดโค้งของแต่ละแผ่น (Per-Piece Curvature & Crimp Analysis) -----
            let rProfileStandard = (typeof getProfileMinSpringRadius === 'function') ? getProfileMinSpringRadius(C.profileName, "") : 35.0; // เกณฑ์โค้งธรรมชาติมาตรฐานแสงไทย
            let halfTheta = Math.asin((run / 2) / R);
            let straightLen = isStraightEaves ? (C.overhang / Math.cos(halfTheta)) : 0;
            let actualArcLen = R * (2 * halfTheta);

            let piecesInfo = [];
            let countNatural = 0;
            let countCrimp = 0;
            let countStraight = 0;

            let currentPos = 0;
            for (let i = 0; i < pieceLens.length; i++) {
                let startCovered = (i === 0) ? 0 : currentPos - overlapLen;
                let endCovered = startCovered + pieceLens[i];
                currentPos = endCovered;

                let sStart = startCovered;
                let sEnd = endCovered;

                let lenStraight1 = 0, lenStraight2 = 0, lenCurved = 0;
                if (isStraightEaves) {
                    lenStraight1 = Math.max(0, Math.min(sEnd, straightLen) - sStart);
                    lenStraight2 = Math.max(0, sEnd - Math.max(sStart, straightLen + actualArcLen));
                    lenCurved = Math.max(0, Math.min(sEnd, straightLen + actualArcLen) - Math.max(sStart, straightLen));
                } else {
                    lenCurved = pieceLens[i];
                }

                let pieceType = 'natural';
                let rLabel = `R = ${R.toFixed(2)} ม.`;
                let statusBadge = '';
                let statusDesc = '';

                if (lenCurved < 0.05) {
                    pieceType = 'straight';
                    rLabel = '— (แผ่นตรง)';
                    statusBadge = '<span class="badge-straight">⚪ แผ่นตรง (ไม่ต้องดัด)</span>';
                    statusDesc = 'ช่วงชายคาตรง ไม่ต้องดัดโค้ง';
                    countStraight += C.sheetCount;
                } else if (lenStraight1 < 0.05 && lenStraight2 < 0.05) {
                    if (R >= rProfileStandard) {
                        pieceType = 'natural';
                        statusBadge = `<span class="badge-natural">🟢 โค้งธรรมชาติ (ไม่ต้องย้ำ)</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. ≥ เกณฑ์รุ่น ${rProfileStandard} ม. (ดัดตามแปได้เลย)`;
                        countNatural += C.sheetCount;
                    } else {
                        pieceType = 'crimp';
                        statusBadge = `<span class="badge-crimp">🟡 ต้องย้ำโค้งช่วย (Crimp)</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. < เกณฑ์รุ่น ${rProfileStandard} ม. (ต้องเข้าเครื่องย้ำ)`;
                        countCrimp += C.sheetCount;
                    }
                } else {
                    let stTotal = lenStraight1 + lenStraight2;
                    rLabel = `R = ${R.toFixed(2)} ม. (ตรง ${stTotal.toFixed(2)}ม. + โค้ง ${lenCurved.toFixed(2)}ม.)`;
                    if (R >= rProfileStandard) {
                        pieceType = 'natural';
                        statusBadge = `<span class="badge-natural">🟢 ชายตรง + โค้งธรรมชาติ</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. ≥ ${rProfileStandard} ม. (ดัดตามแปได้เลย)`;
                        countNatural += C.sheetCount;
                    } else {
                        pieceType = 'crimp';
                        statusBadge = `<span class="badge-crimp">🟡 ชายตรง + ย้ำโค้งช่วย</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. < ${rProfileStandard} ม. (ต้องเข้าเครื่องย้ำ)`;
                        countCrimp += C.sheetCount;
                    }
                }

                let posLabel = (pieces === 1) ? 'เต็มแผ่น' :
                    (i === 0 ? 'ชายล่าง (ฝั่งซ้าย)' : (i === pieces - 1 ? 'ชายล่าง (ฝั่งขวา)' : `ช่วงกลาง #${i}`));

                piecesInfo.push({
                    index: i + 1,
                    posLabel: posLabel,
                    start: startCovered,
                    end: endCovered,
                    length: pieceLens[i],
                    rLabel: rLabel,
                    type: pieceType,
                    statusBadge: statusBadge,
                    statusDesc: statusDesc,
                    lenCurved: lenCurved,
                    lenStraight: lenStraight1 + lenStraight2
                });
            }

            drawCurve(run, h, C.overhang, C.totalLen, R, isStraightEaves, pieceLens, overlapLen, 0, false, piecesInfo);

            let typeText = isStraightEaves ? "ทรงโค้ง (ชายคาตรง)" : "ทรงโค้ง (Curved)";
            if (pieces > 1) typeText += ` (ซอย ${pieces} แผ่น)`;
            document.getElementById('print-type').innerText = typeText;
            document.getElementById('print-slope-h').innerText = `H=${h.toFixed(2)}m / R=${R.toFixed(2)}m (${R >= rProfileStandard ? 'โค้งธรรมชาติ' : 'ต้องย้ำช่วย'})`;
            document.getElementById('print-width').innerText = width;
            document.getElementById('print-run').innerText = run;
            document.getElementById('curveGableRow').style.display = 'block';
            document.getElementById('outGableArea').innerText = C.gableArea.toFixed(2);

            if (pieces > 1) {
                document.getElementById('labelLength').innerText = "ความยาวโค้งรวม (ก่อนซอย)";
            }
            document.getElementById('outLength').innerText = C.totalLen.toFixed(2) + " ม.";

            // --- กล่องวิเคราะห์การดัดโค้ง & รายการตัดแผ่น (Cutting List) ---
            let isOverallNatural = (R >= rProfileStandard);
            let curvSummaryBadge = isOverallNatural ? 
                `<span class="badge-natural" style="font-size:0.9rem;">🟢 ดัดโค้งธรรมชาติได้ (R = ${R.toFixed(2)} ม. ≥ ${rProfileStandard} ม.)</span>` :
                `<span class="badge-crimp" style="font-size:0.9rem;">🟡 ต้องย้ำโค้งช่วย (R = ${R.toFixed(2)} ม. < ${rProfileStandard} ม.)</span>`;
            let curvSummaryDetail = isOverallNatural ?
                `รัศมี R = ${R.toFixed(2)} ม. กว้างกว่าเกณฑ์ขั้นต่ำรุ่น ${C.profileName} (R ≥ ${rProfileStandard} ม.) สามารถดัดโค้งตามโครงสร้างแปหน้างานได้เลย (ประหยัดค่าแรงย้ำ)` :
                `รัศมี R = ${R.toFixed(2)} ม. แคบกว่าเกณฑ์ขั้นต่ำรุ่น ${C.profileName} (R ≥ ${rProfileStandard} ม.) หากดัดธรรมชาติแผ่นอาจโก่ง/พับเสียหาย จำเป็นต้องนำแผ่นเข้าเครื่องย้ำโค้ง`;

            let analysisHtml = `
                <div class="curve-analysis-box">
                    <div class="curve-analysis-title">📐 การวิเคราะห์ความโค้ง & การผลิต (ตามมาตรฐานบริษัท แสงไทย)</div>
                    <div class="curve-analysis-grid">
                        <div class="curve-stat-item">
                            <div class="curve-stat-label">รัศมีความโค้งจริง (R คำนวณ)</div>
                            <div class="curve-stat-val" style="color:#0284c7; font-size:1.1rem;">R = ${R.toFixed(2)} ม.</div>
                            <div class="curve-stat-sub">ความสูงโค้ง H = ${h.toFixed(2)} ม. (สแปน ${run.toFixed(2)} ม.)</div>
                        </div>
                        <div class="curve-stat-item">
                            <div class="curve-stat-label">เกณฑ์โค้งธรรมชาติรุ่นนี้</div>
                            <div class="curve-stat-val" style="color:#15803d; font-size:1.1rem;">R ≥ ${rProfileStandard}.00 ม.</div>
                            <div class="curve-stat-sub">มาตรฐานแสงไทย: ${C.profileName}</div>
                        </div>
                        <div class="curve-stat-item">
                            <div class="curve-stat-label">ผลการประเมินช่าง</div>
                            <div class="curve-stat-val" style="margin-top:2px;">${curvSummaryBadge}</div>
                            <div class="curve-stat-sub">${curvSummaryDetail}</div>
                        </div>
                    </div>
                </div>
            `;

            // ตารางรายการตัดแผ่น (Cutting List Table)
            let thead = document.getElementById('cuttingTableHead');
            if (thead) {
                thead.innerHTML = `<tr>
                    <th style="width:16%;">แผ่นที่</th>
                    <th style="width:18%;">ช่วงระยะบนหลังคา</th>
                    <th style="width:15%;">ความยาวตัด (ม.)</th>
                    <th style="width:23%;">รัศมี R คำนวณจริง</th>
                    <th style="width:28%;">สถานะการดัดโค้ง (เทียบเกณฑ์ ${rProfileStandard} ม.)</th>
                </tr>`;
            }

            let tbody = document.getElementById('sheetListBody');
            tbody.innerHTML = "";
            for (let i = 0; i < piecesInfo.length; i++) {
                let info = piecesInfo[i];
                tbody.innerHTML += `<tr>
                    <td><strong>แผ่นที่ ${info.index}</strong><br><small style="color:#64748b;">${info.posLabel}</small></td>
                    <td>${info.start.toFixed(2)} - ${info.end.toFixed(2)} ม.</td>
                    <td style="font-weight:bold; color:var(--primary-color); font-size:1.05rem;">${info.length.toFixed(2)}</td>
                    <td><strong style="color:#0284c7; font-family:monospace; font-size:1.02rem;">${info.rLabel}</strong></td>
                    <td>${info.statusBadge}<br><small style="color:#64748b;">${info.statusDesc}</small></td>
                </tr>`;
            }
            document.getElementById('cuttingSheetList').style.display = 'block';
            let descText = (pieces > 1) ? 
                `(ซอย ${pieces} แผ่น ทับซ้อนจุดละ ${overlapLen.toFixed(2)} ม. รวมวัสดุ ${targetSum.toFixed(2)} ม./แถว | จำนวนทั้งหมด ${C.sheetCount * pieces} แผ่น)` :
                `(ความยาวแผ่นเต็ม ${C.totalLen.toFixed(2)} ม. จำนวน ${C.sheetCount} แผ่น)`;
            document.getElementById('cutListDesc').innerText = descText;

            let formulaHtml = analysisHtml + `
                <div class="formula-line"><span>1. รัศมีความโค้ง R:</span> <span class="formula-val">(H/2) + (Span² / 8H) = ${R.toFixed(2)} ม.</span></div>
                <div class="formula-line"><span>2. ความยาวโค้งรวม (ก่อนซอย):</span> <span class="formula-val">${C.totalLen.toFixed(2)} ม.</span></div>
            `;
            if (pieces > 1) {
                formulaHtml += `
                    <div class="formula-line"><span>3. ระยะทับซ้อน (${pieces - 1} จุด):</span> <span class="formula-val">${overlapLen.toFixed(2)} × ${pieces - 1} = ${(overlapLen * (pieces - 1)).toFixed(2)} ม.</span></div>
                    <div class="formula-line"><span>4. วัสดุรวมต่อ 1 แถว:</span> <span class="formula-val">${C.totalLen.toFixed(2)} + ${(overlapLen * (pieces - 1)).toFixed(2)} = ${targetSum.toFixed(2)} ม.</span></div>
                `;
            }
            formulaHtml += `
                <div class="formula-line"><span>${pieces > 1 ? '5' : '3'}. พื้นที่ขาย (Billable):</span> <span class="formula-val">${materialLen.toFixed(2)} × ${C.sheetCount} แผ่น × หน้ากว้าง ${C.sheetW} = ${C.billableArea.toFixed(2)} ตร.ม.</span></div>
                <div class="formula-line" style="margin-top:6px; font-weight:700; color:#1e40af;">
                    <span>📊 สรุปจำแนกประเภทการผลิต:</span> 
                    <span class="formula-val">
                        ${countNatural > 0 ? `<span style="color:#15803d;">🟢 โค้งธรรมชาติ ${countNatural} แผ่น</span> ` : ''}
                        ${countCrimp > 0 ? `<span style="color:#b45309;">🟡 ต้องย้ำโค้ง ${countCrimp} แผ่น</span> ` : ''}
                        ${countStraight > 0 ? `<span style="color:#475569;">⚪ แผ่นตรง ${countStraight} แผ่น</span>` : ''}
                    </span>
                </div>
            `;
            document.getElementById('formulaContent').innerHTML = formulaHtml;
            document.getElementById('cuttingFormula').style.display = 'block';
    return true;
}
