// ============================================================
// วาดภาพทรงจั่ว/เพิงแหงน (Slope)
// ============================================================

    function drawRoof(run, angle, overhang, calculatedLen) {
        const canvas = document.getElementById('roofCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 50;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        let rad = angle * (Math.PI / 180);
        let rise = run * Math.tan(rad);
        let overhangDrop = overhang * Math.tan(rad);
        let totalRise = rise + overhangDrop;
        let totalRun = run + overhang; 

        let drawW = w - (padding * 2);
        let drawH = h - (padding * 2);
        let scaleX = drawW / totalRun;
        let scaleY = drawH / (totalRise > 0.5 ? totalRise : 0.5);
        let scale = Math.min(scaleX, drawH / (totalRise * 1.5));
        if(totalRise < 0.5 && scale < 50) scale = 50;

        let diagramWidth = totalRun * scale;
        let startX = (w - diagramWidth) / 2;
        let groundY = h - padding - 20;
        
        let ridgeX = startX;
        let ridgeY = groundY - (totalRise * scale);
        let wallX = ridgeX + (run * scale);
        let wallY = groundY - (overhangDrop * scale);
        let eaveX = ridgeX + (totalRun * scale);
        let eaveY = groundY;

        ctx.beginPath();
        ctx.rect(wallX, wallY, 15, (groundY + 20) - wallY);
        ctx.fillStyle = '#e2e8f0'; ctx.fill();
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.stroke();

        ctx.beginPath(); ctx.moveTo(wallX - 30, groundY + 20); ctx.lineTo(wallX + 45, groundY + 20);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.stroke();

        ctx.beginPath(); ctx.moveTo(ridgeX, ridgeY); ctx.lineTo(wallX, wallY); ctx.lineTo(ridgeX, wallY); ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.fill();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = '#cbd5e1'; ctx.stroke(); ctx.setLineDash([]);

        ctx.beginPath(); ctx.moveTo(ridgeX, ridgeY); ctx.lineTo(eaveX, eaveY);
        ctx.lineWidth = 8; ctx.strokeStyle = '#E30613'; ctx.stroke();
        
        ctx.beginPath(); ctx.arc(ridgeX, ridgeY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#b0050f'; ctx.fill();

        drawDim(ctx, ridgeX, wallY, wallX, wallY, `ระยะราบ ${run.toFixed(2)} ม.`, 40);
        drawDim(ctx, ridgeX, ridgeY, ridgeX, wallY, `สูง ${rise.toFixed(2)}`, -30);
        drawDim(ctx, ridgeX, ridgeY, eaveX, eaveY, `ความยาวแผ่น ${calculatedLen.toFixed(2)} ม.`, -35, '#E30613', true);

        if(overhang > 0) {
            drawDim(ctx, wallX, groundY + 30, eaveX, groundY + 30, `ชายคา ${overhang.toFixed(2)}`, 0, '#475569');
            ctx.save(); ctx.setLineDash([2, 2]); ctx.strokeStyle = '#94a3b8';
            ctx.beginPath(); ctx.moveTo(eaveX, eaveY); ctx.lineTo(eaveX, groundY + 30); ctx.stroke(); ctx.restore();
        }

        ctx.fillStyle = '#1e293b'; ctx.font = 'bold 14px Sarabun'; ctx.fillText(`${angle}°`, ridgeX + 45, wallY - 10);
        ctx.beginPath(); ctx.arc(ridgeX, wallY, 35, 0, -rad, true); ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5; ctx.stroke();
    }
