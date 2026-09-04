// ============================================================
// วาดภาพสี่เหลี่ยมด้านขนาน (Parallelogram)
// ============================================================

    function drawParallelogram(width, run, skew, overhang, sheetData = []) {
        const ctx = document.getElementById('roofCanvas').getContext('2d');
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        
        let totalRun = run + overhang; 
        let maxW = width + Math.abs(skew); 
        
        let scale = Math.min((w-60)/maxW, (h-60)/totalRun);
        
        let dW = width * scale;
        let dRun = totalRun * scale;
        let dSkew = skew * scale;
        
        let startX = (w - (dW + Math.abs(dSkew))) / 2;
        if(dSkew < 0) startX += Math.abs(dSkew); 
        
        let topY = (h - dRun) / 2;
        let botY = topY + dRun;
        
        ctx.beginPath();
        ctx.moveTo(startX + dSkew, topY);
        ctx.lineTo(startX + dSkew + dW, topY);
        ctx.lineTo(startX + dW, botY);
        ctx.lineTo(startX, botY);
        ctx.closePath();
        
        ctx.fillStyle = '#e3f2fd'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#E30613'; ctx.stroke();
        
        if (sheetData.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(startX + dSkew, topY);
            ctx.lineTo(startX + dSkew + dW, topY);
            ctx.lineTo(startX + dW, botY);
            ctx.lineTo(startX, botY);
            ctx.closePath();
            ctx.clip();
            
            sheetData.forEach(sheet => {
                let startRelX = sheet.x;
                if (startRelX > 0 && startRelX < width) {
                    let edgeX_bot = startX + startRelX * scale;
                    let edgeX_top = edgeX_bot + dSkew;
                    ctx.beginPath();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 3]);
                    ctx.moveTo(edgeX_bot, botY);
                    ctx.lineTo(edgeX_top, topY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
            ctx.restore();

            ctx.save();
            sheetData.forEach((sheet, index) => {
                let startRelX = sheet.x;
                let endRelX = sheet.x + sheet.w;
                if (startRelX < 0) startRelX = 0;
                if (endRelX > width) endRelX = width;
                
                let relCenter = (startRelX + endRelX) / 2;
                let centerX = startX + relCenter * scale;
                let labelY = botY - 30 - ((index % 3) * 15);
                
                ctx.font = 'bold 11px Sarabun';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 3;
                let textStr = sheet.id.replace('#','');
                
                ctx.strokeText(textStr, centerX + dSkew/2, labelY);
                ctx.fillStyle = '#d84315';
                ctx.fillText(textStr, centerX + dSkew/2, labelY);
            });
            ctx.restore();
        }
        
        drawDim(ctx, startX, botY+20, startX+dW, botY+20, `กว้าง ${width.toFixed(2)} ม.`, 0, '#333');
        drawDim(ctx, startX-20, topY, startX-20, botY, `ยาว ${run.toFixed(2)} ม.`, 0, '#333');
        if(Math.abs(skew) > 0) {
            drawDim(ctx, startX, topY-20, startX+dSkew, topY-20, `เยื้อง ${skew.toFixed(2)}`, 0, '#666');
        }
        
        ctx.fillStyle = '#E30613';
        ctx.font = "14px Sarabun";
        ctx.fillText("Top View (มุมมองบน)", startX, botY + 45);
    }
