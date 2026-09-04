// ============================================================
// วาดภาพทรงโค้ง (Curve)
// ============================================================

    function drawCurve(span, height, overhang, totalLen, radius, isStraightEaves = false, pieceLens = [], overlapLen = 0, crimpCount = 0, crimpInset = false, piecesInfo = []) {
        const canvas = document.getElementById('roofCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        let totalWidth = span + (overhang * 2);
        let padX = 60;
        let padTop = (pieceLens && pieceLens.length > 1) ? 65 : 45;
        let padBottom = 55;
        
        let drawW = w - (padX * 2);
        let drawH = h - padTop - padBottom;
        let scaleX = drawW / totalWidth;
        let scaleY = drawH / Math.max(height * 2.3, 3.2);
        let scale = Math.min(scaleX, scaleY); 
        
        let startX = (w - (span * scale)) / 2;
        let groundY = h - padBottom - 10;
        let peakY = groundY - (height * scale);
        
        let leftWallX = startX;
        let rightWallX = startX + (span * scale);
        let wallTopY = groundY; 

        ctx.fillStyle = '#e2e8f0'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
        ctx.fillRect(leftWallX - 10, wallTopY, 10, 20); ctx.strokeRect(leftWallX - 10, wallTopY, 10, 20);
        ctx.fillRect(rightWallX, wallTopY, 10, 20); ctx.strokeRect(rightWallX, wallTopY, 10, 20);

        ctx.beginPath();
        ctx.moveTo(leftWallX - 30, groundY + 20); ctx.lineTo(rightWallX + 30, groundY + 20);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();

        let centerX = (leftWallX + rightWallX) / 2;
        let centerY = peakY + (radius * scale); 
        
        let angleLeft = Math.atan2(wallTopY - centerY, leftWallX - centerX);
        let angleRight = Math.atan2(wallTopY - centerY, rightWallX - centerX);

        if (isStraightEaves) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * scale, angleLeft, angleRight);
            ctx.lineWidth = 8; ctx.strokeStyle = '#E30613'; ctx.stroke();

            let tanLeft = angleLeft - (Math.PI / 2);
            let tanRight = angleRight + (Math.PI / 2);
            
            let leftEaveX = leftWallX + (Math.cos(tanLeft) * (overhang*scale / Math.abs(Math.cos(tanLeft))));
            let leftEaveY = wallTopY + (Math.sin(tanLeft) * (overhang*scale / Math.abs(Math.cos(tanLeft))));

            let rightEaveX_v = rightWallX + (Math.cos(tanRight) * (overhang*scale / Math.abs(Math.cos(tanRight))));
            let rightEaveY_v = wallTopY + (Math.sin(tanRight) * (overhang*scale / Math.abs(Math.cos(tanRight))));

            ctx.beginPath(); ctx.moveTo(leftWallX, wallTopY); ctx.lineTo(leftEaveX, leftEaveY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rightWallX, wallTopY); ctx.lineTo(rightEaveX_v, rightEaveY_v); ctx.stroke();

        } else {
            let overhangAngle = overhang / radius;
            let drawStart = angleLeft - overhangAngle;
            let drawEnd = angleRight + overhangAngle;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * scale, drawStart, drawEnd);
            ctx.lineWidth = 8; ctx.strokeStyle = '#E30613'; ctx.stroke();
        }

        // --- เส้นแบ่งแผ่น + ป้ายจำแนกการดัดโค้งของแต่ละแผ่น ---
        let rProfileStandard = (typeof getProfileMinSpringRadius === 'function') ? getProfileMinSpringRadius(document.getElementById('sheetProfile')?.options[document.getElementById('sheetProfile')?.selectedIndex]?.text || "") : 35.0;

        if (pieceLens && pieceLens.length > 1) {
            const rS = radius * scale;
            const halfTheta = Math.asin((span / 2) / radius);
            const straightLen = isStraightEaves ? (overhang / Math.cos(halfTheta)) : 0;
            const arcLenDraw = radius * (2 * halfTheta);
            const drawStart = angleLeft - (overhang / radius);

            // คำนวณปลายชายคาตรงซ้าย/ขวา
            let segL = null, segR = null;
            if (isStraightEaves) {
                let tanL = angleLeft - (Math.PI / 2);
                let tanR = angleRight + (Math.PI / 2);
                let exL = leftWallX + (Math.cos(tanL) * (overhang * scale / Math.abs(Math.cos(tanL))));
                let eyL = wallTopY + (Math.sin(tanL) * (overhang * scale / Math.abs(Math.cos(tanL))));
                let exR = rightWallX + (Math.cos(tanR) * (overhang * scale / Math.abs(Math.cos(tanR))));
                let eyR = wallTopY + (Math.sin(tanR) * (overhang * scale / Math.abs(Math.cos(tanR))));
                segL = { x1: exL, y1: eyL, x2: leftWallX, y2: wallTopY };
                segR = { x1: rightWallX, y1: wallTopY, x2: exR, y2: eyR };
            }

            // แปลงระยะ s เป็นพิกัด + เวกเตอร์ตั้งฉากชี้ออก
            function pointAt(s) {
                if (isStraightEaves) {
                    if (s <= straightLen && straightLen > 0) {
                        let f = s / straightLen;
                        let x = segL.x1 + (segL.x2 - segL.x1) * f;
                        let y = segL.y1 + (segL.y2 - segL.y1) * f;
                        let dx = segL.x2 - segL.x1, dy = segL.y2 - segL.y1;
                        let dl = Math.hypot(dx, dy) || 1;
                        let nx = -dy / dl, ny = dx / dl;
                        if (ny > 0) { nx = -nx; ny = -ny; }
                        return { x, y, nx, ny };
                    } else if (s <= straightLen + arcLenDraw) {
                        let ang = angleLeft + (s - straightLen) / radius;
                        return { x: centerX + rS * Math.cos(ang), y: centerY + rS * Math.sin(ang), nx: Math.cos(ang), ny: Math.sin(ang) };
                    } else {
                        let f = (s - straightLen - arcLenDraw) / (straightLen || 1);
                        let x = segR.x1 + (segR.x2 - segR.x1) * f;
                        let y = segR.y1 + (segR.y2 - segR.y1) * f;
                        let dx = segR.x2 - segR.x1, dy = segR.y2 - segR.y1;
                        let dl = Math.hypot(dx, dy) || 1;
                        let nx = -dy / dl, ny = dx / dl;
                        if (ny > 0) { nx = -nx; ny = -ny; }
                        return { x, y, nx, ny };
                    }
                }
                let ang = drawStart + s / radius;
                return { x: centerX + rS * Math.cos(ang), y: centerY + rS * Math.sin(ang), nx: Math.cos(ang), ny: Math.sin(ang) };
            }

            // หาตำแหน่งรอยต่อ (กลางช่วงทับซ้อน) และจุดกึ่งกลางของแต่ละแผ่น
            let joints = [];
            let mids = [];
            let covered = 0;
            for (let i = 0; i < pieceLens.length; i++) {
                let startCovered = (i === 0) ? 0 : covered - overlapLen;
                mids.push(startCovered + pieceLens[i] / 2);
                covered = startCovered + pieceLens[i];
                if (i < pieceLens.length - 1) joints.push(covered - overlapLen / 2);
            }

            // วาดขีดแบ่งรอยต่อ
            joints.forEach(j => {
                let p = pointAt(j);
                ctx.beginPath();
                ctx.strokeStyle = '#1d4ed8';
                ctx.lineWidth = 3;
                ctx.moveTo(p.x - p.nx * 14, p.y - p.ny * 14);
                ctx.lineTo(p.x + p.nx * 14, p.y + p.ny * 14);
                ctx.stroke();
            });

            // วาดป้ายและตัวเลขแผ่นพร้อมสถานะการดัดโค้ง
            mids.forEach((m, i) => {
                let p = pointAt(m);
                let info = piecesInfo[i] || {};
                let pType = info.type || (radius >= rProfileStandard ? 'natural' : 'crimp');
                let tagText = `แผ่นที่ ${i + 1} (${pieceLens[i].toFixed(2)}ม.)`;
                let subTag = '';

                if (pType === 'straight') {
                    subTag = '⚪ แผ่นตรง';
                } else if (pType === 'natural' || pType === 'compound-natural') {
                    subTag = `R=${radius.toFixed(1)}ม. · 🟢 โค้งธรรมชาติ`;
                } else {
                    subTag = info.pieceCrimpCount ? `R=${radius.toFixed(1)}ม. · 🟡 ย้ำ ${info.pieceCrimpCount} ครั้ง` : `R=${radius.toFixed(1)}ม. · 🟡 ย้ำช่วย`;
                }

                let lx = p.x + p.nx * 42;
                let ly = p.y + p.ny * 42;

                // Draw Pill Badge Background
                ctx.save();
                ctx.font = 'bold 11px Sarabun';
                let w1 = ctx.measureText(tagText).width;
                ctx.font = 'bold 10px Sarabun';
                let w2 = ctx.measureText(subTag).width;
                let txtW = Math.max(w1, w2) + 20;
                let txtH = 34;

                ctx.shadowColor = "rgba(0,0,0,0.08)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetY = 2;

                ctx.fillStyle = (pType === 'natural' || pType === 'compound-natural') ? '#f0fdf4' :
                                (pType === 'straight' ? '#f8fafc' : '#fffbeb');
                ctx.strokeStyle = (pType === 'natural' || pType === 'compound-natural') ? '#22c55e' :
                                  (pType === 'straight' ? '#94a3b8' : '#f59e0b');
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                ctx.roundRect(lx - txtW / 2, ly - txtH / 2, txtW, txtH, 6);
                ctx.fill();
                ctx.stroke();

                // Draw Tag Text
                ctx.shadowColor = "transparent";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 11px Sarabun';
                ctx.fillStyle = '#0f172a';
                ctx.fillText(tagText, lx, ly - 7);

                ctx.font = 'bold 10px Sarabun';
                ctx.fillStyle = (pType === 'natural' || pType === 'compound-natural') ? '#15803d' :
                                (pType === 'straight' ? '#475569' : '#b45309');
                ctx.fillText(subTag, lx, ly + 7);
                ctx.restore();
            });

            // ป้ายความยาวโค้งรวม จัดวางที่มุมซ้ายบนของผืนผ้าใบ (Top-Left HUD) ไม่บังรูปทรงหลังคาและป้ายแผ่น 100%
            ctx.save();
            ctx.font = 'bold 12px Sarabun';
            let bannerText = `📐 ความยาวโค้งรวม ${totalLen.toFixed(2)} ม. (ซอย ${pieceLens.length} แผ่น)`;
            let bW = ctx.measureText(bannerText).width + 20;
            let bH = 26;
            let bX = 18;
            let bY = 16;

            ctx.shadowColor = "rgba(0,0,0,0.06)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 1;

            ctx.fillStyle = '#fef2f2';
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(bX, bY, bW, bH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.shadowColor = "transparent";
            ctx.fillStyle = '#dc2626';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(bannerText, bX + 10, bY + bH / 2);
            ctx.restore();

        } else {
            // แผ่นเดียวเต็มแผ่น - วางที่มุมซ้ายบนเช่นกันให้เรียบร้อยเป็นมาตรฐาน
            ctx.save();
            ctx.font = 'bold 12px Sarabun';
            let bannerText = `📐 ความยาวโค้งรวม ${totalLen.toFixed(2)} ม. (1 แผ่นเต็ม)`;
            let bW = ctx.measureText(bannerText).width + 20;
            let bH = 26;
            let bX = 18;
            let bY = 16;

            ctx.shadowColor = "rgba(0,0,0,0.06)";
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 1;

            ctx.fillStyle = '#fef2f2';
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(bX, bY, bW, bH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.shadowColor = "transparent";
            ctx.fillStyle = '#dc2626';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(bannerText, bX + 10, bY + bH / 2);
            ctx.restore();
        }

        // --- ขีดตำแหน่งย้ำบนส่วนโค้ง (โหมดย้ำโค้งโดรม) ---
        if (crimpCount && crimpCount > 0) {
            const rS = radius * scale;
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = 2;
            for (let k = 0; k < crimpCount; k++) {
                let ang;
                if (crimpInset) {
                    ang = angleLeft + (angleRight - angleLeft) * ((k + 1) / (crimpCount + 1));
                } else if (crimpCount > 1) {
                    ang = angleLeft + (angleRight - angleLeft) * (k / (crimpCount - 1));
                } else {
                    ang = (angleLeft + angleRight) / 2;
                }
                let ca = Math.cos(ang), sa = Math.sin(ang);
                let px = centerX + rS * ca;
                let py = centerY + rS * sa;
                ctx.beginPath();
                ctx.moveTo(px - ca * 6, py - sa * 6);
                ctx.lineTo(px + ca * 6, py + sa * 6);
                ctx.stroke();
            }
        }

        // บอกระยะ Span (สแปน) ด้านล่าง
        drawDim(ctx, leftWallX, wallTopY, rightWallX, wallTopY, `Span ${span.toFixed(2)} ม.`, 38);

        // บอกระยะความสูง H เยื้องไปทางซ้ายของแกนกลาง (ไม่ทับตัวหนังสืออื่น)
        drawDim(ctx, centerX - 40, wallTopY, centerX - 40, peakY, `H ${height.toFixed(2)} ม.`, -18);

        // ป้ายข้อมูลรัศมี R ใต้ท้องโค้ง ฝั่งขวาของแกนกลาง (สะอาด ชัดเจน ไม่เบียด)
        ctx.save();
        let isNatural = (radius >= rProfileStandard);
        let rTag = isNatural ? `🟢 โค้งธรรมชาติ (R ≥ ${rProfileStandard}ม.)` : `🟡 ต้องย้ำช่วย (R < ${rProfileStandard}ม.)`;
        let rBoxY = peakY + (wallTopY - peakY) * 0.45;
        let rBoxX = centerX + 45;

        ctx.font = 'bold 11px Sarabun';
        let rLine1 = `รัศมี R = ${radius.toFixed(2)} ม.`;
        let rLine2 = rTag;
        let rbW = Math.max(ctx.measureText(rLine1).width, ctx.measureText(rLine2).width) + 16;
        let rbH = 34;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(rBoxX - rbW / 2, rBoxY - rbH / 2, rbW, rbH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0284c7';
        ctx.fillText(rLine1, rBoxX, rBoxY - 7);

        ctx.font = 'bold 10px Sarabun';
        ctx.fillStyle = isNatural ? '#15803d' : '#b45309';
        ctx.fillText(rLine2, rBoxX, rBoxY + 7);
        ctx.restore();
    }
