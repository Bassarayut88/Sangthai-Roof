// ============================================================
// วาดภาพสี่เหลี่ยมด้านไม่เท่า (Irregular)
// ============================================================

    function drawIrregular(width, hTL, hTR, hBL, hBR, sheetData = []) {
        const ctx = document.getElementById('roofCanvas').getContext('2d');
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        
        let maxH = Math.max(hTL, hTR);
        
        let scale = Math.min((w-60)/width, (h-60)/maxH);
        let dW = width * scale;
        
        let x = (w - dW)/2;
        let groundY = h - 30;
        
        let yBL = groundY - (hBL * scale);
        let yBR = groundY - (hBR * scale);
        let yTL = groundY - (hTL * scale);
        let yTR = groundY - (hTR * scale);
        
        ctx.beginPath();
        ctx.moveTo(x, yBL);
        ctx.lineTo(x, yTL);
        ctx.lineTo(x + dW, yTR);
        ctx.lineTo(x + dW, yBR);
        ctx.closePath();
        
        ctx.fillStyle = '#e3f2fd'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#E30613'; ctx.stroke();
        
        drawDim(ctx, x, groundY+20, x+dW, groundY+20, `กว้าง ${width.toFixed(2)} ม.`, 0, '#333');
        drawDim(ctx, x-20, yBL, x-20, yTL, `L ${(hTL - hBL).toFixed(2)}`, 0, '#333');
        drawDim(ctx, x+dW+20, yBR, x+dW+20, yTR, `R ${(hTR - hBR).toFixed(2)}`, 0, '#333');

        if (sheetData.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, yBL);
            ctx.lineTo(x, yTL);
            ctx.lineTo(x + dW, yTR);
            ctx.lineTo(x + dW, yBR);
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
                    ctx.moveTo(edgeX, 0);
                    ctx.lineTo(edgeX, h);
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
                
                let ytCenter = hTL + (hTR - hTL) * (relCenter / width);
                let ybCenter = hBL + (hBR - hBL) * (relCenter / width);
                let yTopCanvas = groundY - (ytCenter * scale);
                let yBotCanvas = groundY - (ybCenter * scale);

                drawVerticalSheetDim(ctx, centerX, yBotCanvas, yTopCanvas, sheet.len.toFixed(2), '#16a34a');
                
                let labelY = yBotCanvas - 20 - ((index % 3) * 15);
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
