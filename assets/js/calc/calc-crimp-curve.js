// ============================================================
// โมดูลคำนวณ: ย้ำโค้งโดรม (Crimp Curve Dome) — หัวข้อ 11
// พื้นฐานเหมือนทรงโค้ง (calc-curve.js) แต่เพิ่มการคำนวณย้ำ:
//   ให้ "องศาต่อ 1 ย้ำ" → คืน จำนวนย้ำจริง / องศาจริง / ระยะห่างย้ำ
// รับ C = context กลางจาก calculate() (ดู assets/js/calc/calculate.js)
// คืนค่า true เมื่อคำนวณสำเร็จ / false เมื่อข้อมูลไม่ครบ (แจ้งเตือนแล้ว)
// ============================================================

function calcCrimpCurve(C) {
            document.getElementById('labelLength').innerText = "ความยาวแผ่นตัด (โค้งย้ำ)";
            let width = parseFloat(document.getElementById('roofWidth').value) || 0;
            let run = parseFloat(document.getElementById('roofRun').value) || 0;
            let curveVal = parseFloat(document.getElementById('curveValue').value) || 0;
            let isStraightEaves = document.getElementById('straightEaves').checked;

            if(width===0 || run===0 || curveVal===0) { showWarning("⚠️ กรุณากรอกข้อมูลให้ครบ"); return false; }

            let degPerCrimp = parseFloat(document.getElementById('crimpDegree').value) || 0;
            if (degPerCrimp <= 0) { showWarning("⚠️ กรุณาระบุองศาต่อ 1 ย้ำ ให้มากกว่า 0"); return false; }

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

            // ----- การย้ำโค้ง (คิดเฉพาะส่วนโค้ง ไม่รวมชายคา) -----
            let edgeModeEl = document.getElementById('crimpEdgeMode');
            let edgeMode = edgeModeEl ? edgeModeEl.value : 'edge'; // 'edge' = ชิดขอบ / 'inset' = เว้นขอบ 1 ช่อง
            let sweepDeg = theta * (180 / Math.PI);        // มุมโค้งรวม (องศา)
            let crimpCount, spaces;
            if (edgeMode === 'inset') {
                // เว้นขอบ 1 ช่องทั้งสองฝั่ง: ช่องห่าง = จำนวนย้ำ + 1
                // (ลดจำนวนย้ำลง 1 เพื่อให้ระยะห่างจริงใกล้องศาที่กรอก)
                crimpCount = Math.round(sweepDeg / degPerCrimp) - 1;
                if (crimpCount < 1) crimpCount = 1;
                spaces = crimpCount + 1;
            } else {
                // ย้ำชิดขอบทั้งสองฝั่ง: ย้ำแรก-สุดท้ายอยู่ที่ขอบโค้งพอดี
                crimpCount = Math.round(sweepDeg / degPerCrimp); // จำนวนย้ำ (เส้น)
                if (crimpCount < 2) crimpCount = 2;
                spaces = crimpCount - 1;                // จำนวนช่องห่างระหว่างย้ำ
            }
            let realDegree = sweepDeg / spaces;             // องศาจริงต่อช่อง
            let realSpacingM = arcLen / spaces;             // ระยะห่างย้ำจริง (ม.)
            let realSpacingCm = realSpacingM * 100;         // ระยะห่างย้ำจริง (ซม.)

            // ----- ซอยแผ่นตามความยาวโค้ง (พร้อมระยะทับซ้อน) เหมือนทรงโค้ง -----
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
            // ----- วิเคราะห์การดัดโค้งและการย้ำของแต่ละแผ่น (Per-Piece Curvature & Crimp Analysis) -----
            let rProfileStandard = (typeof getProfileMinSpringRadius === 'function') ? getProfileMinSpringRadius(C.profileName, "") : 35.0; // เกณฑ์โค้งธรรมชาติมาตรฐานแสงไทย
            let halfTheta = Math.asin((run / 2) / R);
            let straightLen = isStraightEaves ? (C.overhang / Math.cos(halfTheta)) : 0;
            let actualArcLen = R * (2 * halfTheta);

            let piecesInfo = [];
            let countNatural = 0;
            let countCrimp = 0;
            let countStraight = 0;
            let totalCrimpHitsAllPieces = 0;

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

                let pieceType = 'crimp';
                let rLabel = `R = ${R.toFixed(2)} ม.`;
                let statusBadge = '';
                let statusDesc = '';
                let pieceCrimpCount = 0;

                if (lenCurved < 0.05) {
                    pieceType = 'straight';
                    rLabel = '— (แผ่นตรง)';
                    statusBadge = '<span class="badge-straight">⚪ แผ่นตรง (ไม่ต้องย้ำ)</span>';
                    statusDesc = 'ช่วงชายคาตรง ไม่ต้องดัดโค้ง';
                    countStraight += C.sheetCount;
                } else if (lenStraight1 < 0.05 && lenStraight2 < 0.05) {
                    // Pure curve piece
                    let pieceDeg = (lenCurved / R) * (180 / Math.PI);
                    pieceCrimpCount = (pieces === 1) ? crimpCount : Math.max(1, Math.round(pieceDeg / degPerCrimp));
                    totalCrimpHitsAllPieces += pieceCrimpCount;

                    if (R >= rProfileStandard) {
                        pieceType = 'natural';
                        statusBadge = `<span class="badge-natural">🟢 โค้งธรรมชาติ (ไม่ต้องย้ำ)</span> <span style="font-size:0.75rem; color:#64748b;">(หรือย้ำ ${pieceCrimpCount} ครั้ง)</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. ≥ เกณฑ์รุ่น ${rProfileStandard} ม. (ระยะห่างย้ำ ${realSpacingCm.toFixed(1)} ซม.)`;
                        countNatural += C.sheetCount;
                    } else {
                        pieceType = 'crimp';
                        statusBadge = `<span class="badge-crimp">🟡 ต้องย้ำโค้งช่วย</span> <span class="crimp-pill-count">ย้ำ ${pieceCrimpCount} ครั้ง</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. < เกณฑ์รุ่น ${rProfileStandard} ม. (ห่าง ${realSpacingCm.toFixed(1)} ซม.)`;
                        countCrimp += C.sheetCount;
                    }
                } else {
                    // Compound piece (straight + curve)
                    let stTotal = lenStraight1 + lenStraight2;
                    let pieceDeg = (lenCurved / R) * (180 / Math.PI);
                    pieceCrimpCount = Math.max(1, Math.round(pieceDeg / degPerCrimp));
                    totalCrimpHitsAllPieces += pieceCrimpCount;

                    rLabel = `R = ${R.toFixed(2)} ม. (ตรง ${stTotal.toFixed(2)}ม. + โค้ง ${lenCurved.toFixed(2)}ม.)`;
                    if (R >= rProfileStandard) {
                        pieceType = 'natural';
                        statusBadge = `<span class="badge-natural">🟢 ชายตรง + โค้งธรรมชาติ</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. ≥ ${rProfileStandard} ม. (ช่วงตรง ${stTotal.toFixed(2)} ม.)`;
                        countNatural += C.sheetCount;
                    } else {
                        pieceType = 'crimp';
                        statusBadge = `<span class="badge-crimp">🟡 ชายตรง + ย้ำโค้งช่วย</span> <span class="crimp-pill-count">ย้ำ ${pieceCrimpCount} ครั้ง</span>`;
                        statusDesc = `R = ${R.toFixed(2)} ม. < ${rProfileStandard} ม. (ย้ำ ${pieceCrimpCount} ครั้ง ห่าง ${realSpacingCm.toFixed(1)} ซม.)`;
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
                    pieceCrimpCount: pieceCrimpCount,
                    lenCurved: lenCurved,
                    lenStraight: lenStraight1 + lenStraight2
                });
            }

            drawCurve(run, h, C.overhang, C.totalLen, R, isStraightEaves, pieceLens, overlapLen, crimpCount, edgeMode === 'inset', piecesInfo);

            let typeText = isStraightEaves ? "ย้ำโค้งโดรม (ชายคาตรง)" : "ย้ำโค้งโดรม (Crimp Dome)";
            if (pieces > 1) typeText += ` (ซอย ${pieces} แผ่น)`;
            document.getElementById('print-type').innerText = typeText;
            document.getElementById('print-slope-h').innerText = `H=${h.toFixed(2)}m / R=${R.toFixed(2)}m / ย้ำ ${crimpCount} ครั้ง (${R >= rProfileStandard ? 'โค้งธรรมชาติ' : 'ต้องย้ำช่วย'})`;
            document.getElementById('print-width').innerText = width;
            document.getElementById('print-run').innerText = run;
            document.getElementById('curveGableRow').style.display = 'block';
            document.getElementById('outGableArea').innerText = C.gableArea.toFixed(2);

            // แถวสรุปข้อมูลการย้ำ
            document.getElementById('crimpInfoRow').style.display = 'block';
            document.getElementById('outCrimpCount').innerText = crimpCount + " ครั้ง";
            document.getElementById('outCrimpDegree').innerText = realDegree.toFixed(2) + "°";
            document.getElementById('outCrimpSpacing').innerText = realSpacingCm.toFixed(2) + " ซม.";

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
                `รัศมี R = ${R.toFixed(2)} ม. กว้างกว่าเกณฑ์ขั้นต่ำรุ่น ${C.profileName} (R ≥ ${rProfileStandard} ม.) สามารถดัดโค้งตามแปได้เลย (หากต้องการย้ำเข้ารูปเป๊ะ ย้ำ ${crimpCount} ครั้ง)` :
                `รัศมี R = ${R.toFixed(2)} ม. แคบกว่าเกณฑ์ขั้นต่ำรุ่น ${C.profileName} (R ≥ ${rProfileStandard} ม.) จำเป็นต้องนำแผ่นเข้าเครื่องย้ำโค้ง ${crimpCount} ครั้ง (ห่าง ${realSpacingCm.toFixed(1)} ซม.)`;

            let analysisHtml = `
                <div class="curve-analysis-box">
                    <div class="curve-analysis-title">📐 การวิเคราะห์ความโค้ง & การย้ำ (ตามมาตรฐานบริษัท แสงไทย)</div>
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
                            <div class="curve-stat-label">ผลการประเมินการย้ำ</div>
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
                    <th style="width:28%;">สถานะการดัดโค้ง / การย้ำ</th>
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
                `(ซอย ${pieces} แผ่น ทับซ้อนจุดละ ${overlapLen.toFixed(2)} ม. รวมวัสดุ ${targetSum.toFixed(2)} ม./แถว | ย้ำรวมทั้งแถว ${crimpCount} ครั้ง)` :
                `(ความยาวแผ่นเต็ม ${C.totalLen.toFixed(2)} ม. จำนวน ${C.sheetCount} แผ่น | ย้ำ ${crimpCount} ครั้ง/แผ่น)`;
            document.getElementById('cutListDesc').innerText = descText;

            // --- กล่องสูตรย้ำโค้ง ---
            let modeLabel = (edgeMode === 'inset') ? 'เว้นขอบ 1 ช่องทั้งสองฝั่ง' : 'ย้ำชิดขอบทั้งสองฝั่ง';
            let formulaHtml = analysisHtml + `
                <div class="formula-line"><span>1. มุมโค้งรวม (Sweep):</span> <span class="formula-val">${sweepDeg.toFixed(2)}°</span></div>
                <div class="formula-line"><span>2. ความยาวส่วนโค้ง (Arc):</span> <span class="formula-val">${arcLen.toFixed(2)} ม.</span></div>
                <div class="formula-line"><span>3. รูปแบบตำแหน่งย้ำ:</span> <span class="formula-val">${modeLabel}</span></div>
                <div class="formula-line"><span>4. จำนวนย้ำรวม:</span> <span class="formula-val">round(${sweepDeg.toFixed(2)}° ÷ ${degPerCrimp}°)${edgeMode === 'inset' ? ' − 1' : ''} = ${crimpCount} ครั้ง (${spaces} ช่อง)</span></div>
                <div class="formula-line"><span>5. องศาจริงต่อช่อง:</span> <span class="formula-val">${sweepDeg.toFixed(2)}° ÷ ${spaces} ช่อง = ${realDegree.toFixed(2)}°</span></div>
                <div class="formula-line"><span>6. ระยะห่างย้ำ:</span> <span class="formula-val">${arcLen.toFixed(2)} ÷ ${spaces} ช่อง = ${realSpacingM.toFixed(3)} ม. (${realSpacingCm.toFixed(2)} ซม.)</span></div>
            `;
            if (edgeMode === 'inset') {
                formulaHtml += `
                <div class="formula-line"><span>7. ระยะเว้นขอบก่อนย้ำแรก:</span> <span class="formula-val">1 ช่อง = ${realSpacingCm.toFixed(2)} ซม. (ทั้งสองฝั่ง)</span></div>
            `;
            }
            if (pieces > 1) {
                formulaHtml += `
                    <div class="formula-line"><span>8. วัสดุรวมต่อ 1 แถว (รวมทับซ้อน):</span> <span class="formula-val">${C.totalLen.toFixed(2)} + ${(overlapLen * (pieces - 1)).toFixed(2)} = ${targetSum.toFixed(2)} ม.</span></div>
                `;
            }
            formulaHtml += `
                <div class="formula-line"><span>${pieces > 1 ? '9' : '8'}. พื้นที่ขาย (Billable):</span> <span class="formula-val">${materialLen.toFixed(2)} × ${C.sheetCount} แผ่น × หน้ากว้าง ${C.sheetW} = ${C.billableArea.toFixed(2)} ตร.ม.</span></div>
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
