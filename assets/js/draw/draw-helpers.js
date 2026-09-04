// ============================================================
// ฟังก์ชันวาดภาพช่วย: ตาราง / เส้นบอกระยะ / หัวลูกศร / ระยะแนวตั้ง
// ============================================================

    function drawGrid(ctx, w, h) {
        ctx.save();
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        const step = 40;
        ctx.beginPath();
        for (let x = 0.5; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0.5; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
        ctx.restore();
    }
    
    function drawDim(ctx, x1, y1, x2, y2, text, offset, color = '#334155', isSlope = false) {
        ctx.save();
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1; ctx.font = 'bold 13px Sarabun';
        let dx = x2 - x1; let dy = y2 - y1;
        let lineAngle = Math.atan2(dy, dx);
        let perpAngle = lineAngle + Math.PI / 2;
        let ox1 = x1 + Math.cos(perpAngle) * offset; let oy1 = y1 + Math.sin(perpAngle) * offset;
        let ox2 = x2 + Math.cos(perpAngle) * offset; let oy2 = y2 + Math.sin(perpAngle) * offset;

        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ox1, oy1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(ox2, oy2); ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.beginPath(); ctx.moveTo(ox1, oy1); ctx.lineTo(ox2, oy2); ctx.stroke();
        drawArrow(ctx, ox1, oy1, lineAngle + Math.PI); drawArrow(ctx, ox2, oy2, lineAngle);

        let midX = (ox1 + ox2) / 2; let midY = (oy1 + oy2) / 2;
        let metrics = ctx.measureText(text); let p = 6;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        if(isSlope) {
             ctx.translate(midX, midY); ctx.rotate(lineAngle);
             ctx.roundRect(-metrics.width/2 - p, -10 - p, metrics.width + p*2, 20 + p, 4); ctx.fill();
             ctx.shadowColor = "rgba(0,0,0,0.1)"; ctx.shadowBlur = 4;
             ctx.fillStyle = color; ctx.fillText(text, -metrics.width/2, 4);
        } else {
             ctx.roundRect(midX - metrics.width/2 - p, midY - 10 - p, metrics.width + p*2, 20 + p, 4); ctx.fill();
             ctx.shadowColor = "rgba(0,0,0,0.1)"; ctx.shadowBlur = 4;
             ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, midX, midY);
        }
        ctx.restore();
    }

    function drawArrow(ctx, x, y, angle) {
        let headlen = 6; ctx.save(); ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); ctx.restore();
    }

    function drawVerticalSheetDim(ctx, x, yBottom, yTop, text, color = '#16a34a') {
        if (Math.abs(yBottom - yTop) < 15) return;
        ctx.save();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yBottom);
        ctx.lineTo(x, yTop);
        ctx.stroke();

        ctx.fillStyle = color;
        drawArrow(ctx, x, yBottom, Math.PI / 2);
        drawArrow(ctx, x, yTop, -Math.PI / 2);

        ctx.font = '11px Sarabun';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let midY = (yBottom + yTop) / 2;
        ctx.translate(x - 8, midY);
        ctx.rotate(-Math.PI / 2);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 0, 0);
        
        ctx.fillStyle = color;
        ctx.fillText(text, 0, 0);
        
        ctx.restore();
    }

    // ============================================================
    // มาตรฐานรัศมีโค้งธรรมชาติต่ำสุด (MINIMUM SPRING RADIUS) บริษัท แสงไทย
    // ============================================================
    function getProfileMinSpringRadius(profileText, profileVal) {
        let str = (String(profileText || "") + " " + String(profileVal || "")).toUpperCase();
        if (str.includes("39-700") || str.includes("700")) return 55;
        if (str.includes("40-750") || str.includes("ST40") || str.includes("32-760") || str.includes("38-750")) return 50;
        if (str.includes("29-730") || str.includes("730")) return 40;
        if (str.includes("SNAPLOCK") || str.includes("300")) return 45;
        if (str.includes("20-800") || str.includes("800")) return 35;
        if (str.includes("760") || str.includes("750") || str.includes("SPAIN")) return 35;
        return 35; // มาตรฐานแสงไทยเริ่มต้น
    }
