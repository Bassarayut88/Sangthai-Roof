// ============================================================
// วาดภาพสี่เหลี่ยมคางหมู (Trapezoid)
// ============================================================

    function drawTrapezoid(width, hL, hR, sheetData = []) {
        const ctx = document.getElementById('roofCanvas').getContext('2d');
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        
        let maxHeight = Math.max(hL, hR);
        let scale = Math.min((w-60)/width, (h-60)/maxHeight);
        
        let dW = width * scale;
        let dHL = hL * scale;
        let dHR = hR * scale;
        
        let x = (w - dW)/2;
        let bottomY = (h + maxHeight*scale)/2 + 20; 
        if(bottomY > h-30) bottomY = h-30;

        ctx.beginPath();
        ctx.moveTo(x, bottomY);
        ctx.lineTo(x + dW, bottomY);
        ctx.lineTo(x + dW, bottomY - dHR);
        ctx.lineTo(x, bottomY - dHL);
        ctx.closePath();
        
        ctx.fillStyle = '#e3f2fd'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#E30613'; ctx.stroke();
        
        drawDim(ctx, x, bottomY+25, x+dW, bottomY+25, `กว้าง ${width.toFixed(2)} ม.`, 0, '#333');
        drawDim(ctx, x-20, bottomY, x-20, bottomY-dHL, `L ${hL.toFixed(2)}`, 0, '#333');
        drawDim(ctx, x+dW+20, bottomY, x+dW+20, bottomY-dHR, `R ${hR.toFixed(2)}`, 0, '#333');

        if (sheetData.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, bottomY);
            ctx.lineTo(x + dW, bottomY);
            ctx.lineTo(x + dW, bottomY - dHR);
            ctx.lineTo(x, bottomY - dHL);
            ctx.closePath();
            ctx.clip();

            sheetData.forEach(sheet => {
                let startRelX = sheet.x;
                if (startRelX > 0 && startRelX < width) {
                    let edgeX = x + startRelX * scale;
                    ctx.beginPath();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 3]);
                    ctx.moveTo(edgeX, bottomY);
                    ctx.lineTo(edgeX, bottomY - Math.max(dHL, dHR));
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
                let centerX = x + relCenter * scale;
                
                let ytCenter = hL + (hR - hL) * (relCenter / width);
                let yTopCanvas = bottomY - (ytCenter * scale);

                drawVerticalSheetDim(ctx, centerX, bottomY, yTopCanvas, sheet.len.toFixed(2), '#16a34a');

                let labelY = bottomY - 12;
                ctx.fillStyle = '#d84315';
                ctx.font = 'bold 11px Sarabun';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 3;
                let textStr = sheet.id.replace('#','');
                ctx.strokeText(textStr, centerX, labelY);
                ctx.fillText(textStr, centerX, labelY);
            });
            ctx.restore();
        }
    }
