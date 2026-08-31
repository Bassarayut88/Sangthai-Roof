// ============================================================
// วาดภาพทรงโค้ง (Curve)
// ============================================================

    function drawCurve(span, height, overhang, totalLen, radius, isStraightEaves = false, pieceLens = [], overlapLen = 0, crimpCount = 0, crimpInset = false) {
        const canvas = document.getElementById('roofCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 50;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        let totalWidth = span + (overhang * 2);
        let totalHeight = height + (height * 0.2); 
        
        let drawW = w - (padding * 2);
        let drawH = h - (padding * 2);
        let scaleX = drawW / totalWidth;
        let scaleY = drawH / (totalHeight > 0 ? totalHeight : 1);
        let scale = Math.min(scaleX, drawH / (height * 2.5)); 
        
        let startX = (w - (span * scale)) / 2;
        let groundY = h - padding - 20;
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

        // --- เส้นแบ่งแผ่น + เลขแผ่น (กรณีซอยแผ่นตามความยาวโค้ง) ---
        if (pieceLens && pieceLens.length > 1) {
            const rS = radius * scale;
            const halfTheta = Math.asin((span / 2) / radius);
            const straightLen = isStraightEaves ? (overhang / Math.cos(halfTheta)) : 0;
            const arcLenDraw = radius * (2 * halfTheta);
            const drawStart = angleLeft - (overhang / radius);

            // คำนวณปลายชายคาตรงซ้าย/ขวา (กรณีชายคาเป็นแผ่นตรง)
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

            // แปลง "ระยะตามความยาววัสดุ s" เป็นจุดบนภาพ + เวกเตอร์ตั้งฉากชี้ออก
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
            let covered = 0; // ตำแหน่งปลายแผ่น (หักทับซ้อนแล้ว) ตามความยาวโค้ง
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
                ctx.lineWidth = 2.5;
                ctx.moveTo(p.x - p.nx * 10, p.y - p.ny * 10);
                ctx.lineTo(p.x + p.nx * 10, p.y + p.ny * 10);
                ctx.stroke();
            });

            // วาดเลขแผ่นเหนือเส้นโค้ง
            mids.forEach((m, i) => {
                let p = pointAt(m);
                let lx = p.x + p.nx * 22;
                let ly = p.y + p.ny * 22;
                ctx.font = 'bold 12px Sarabun';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                ctx.lineWidth = 4;
                ctx.strokeText(`${i + 1}`, lx, ly);
                ctx.fillStyle = '#1d4ed8';
                ctx.fillText(`${i + 1}`, lx, ly);
            });
        }

        // --- ขีดตำแหน่งย้ำบนส่วนโค้ง (โหมดย้ำโค้งโดรม) ---
        if (crimpCount && crimpCount > 0) {
            const rS = radius * scale;
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = 2;
            for (let k = 0; k < crimpCount; k++) {
                let ang;
                if (crimpInset) {
                    // เว้นขอบ 1 ช่องทั้งสองฝั่ง: ย้ำแรกห่างจากขอบ 1 ช่อง
                    ang = angleLeft + (angleRight - angleLeft) * ((k + 1) / (crimpCount + 1));
                } else if (crimpCount > 1) {
                    // ย้ำชิดขอบ: เส้นแรก-สุดท้ายอยู่ที่ขอบโค้งพอดี
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

        drawDim(ctx, leftWallX, wallTopY, rightWallX, wallTopY, `Span ${span.toFixed(2)} ม.`, 40);
        drawDim(ctx, centerX, wallTopY, centerX, peakY, `H ${height.toFixed(2)}`, -20);
        
        ctx.fillStyle = '#666'; ctx.font = '12px Sarabun';
        ctx.fillText(`R = ${radius.toFixed(2)} ม.`, centerX, centerY - (radius*scale) + 20);
        
        ctx.fillStyle = '#E30613'; ctx.font = 'bold 14px Sarabun';
        ctx.fillText(`ความยาวโค้ง ${totalLen.toFixed(2)} ม.`, centerX - 60, peakY - 15);
    }
