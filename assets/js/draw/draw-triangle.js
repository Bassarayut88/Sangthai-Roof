// ============================================================
// วาดภาพทรงสามเหลี่ยม หน้าจั่ว (Triangle)
// ============================================================

    function drawTriangle(base, height, origBase, origHeight, sheetData = []) {
        const ctx = document.getElementById('roofCanvas').getContext('2d');
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        
        let scale = Math.min((w-60)/base, (h-60)/height);
        let db = base * scale;
        let dh = height * scale;
        
        let x = (w - db)/2;
        let y = (h - dh)/2 + dh; 
        
        ctx.beginPath();
        ctx.moveTo(x, y); 
        ctx.lineTo(x + db, y); 
        ctx.lineTo(x + db/2, y - dh); 
        ctx.closePath();
        
        ctx.fillStyle = '#e3f2fd'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#E30613'; ctx.stroke();
        
        if(origBase && origBase < base) {
             let dOB = origBase * scale;
             let dOH = origHeight * scale;
             let apexX = x + db/2;
             let apexY = y - dh;
             
             ctx.save();
             ctx.setLineDash([5, 5]);
             ctx.strokeStyle = '#555';
             ctx.beginPath();
             ctx.moveTo(apexX - dOB/2, apexY + dOH);
             ctx.lineTo(apexX + dOB/2, apexY + dOH);
             ctx.lineTo(apexX, apexY);
             ctx.closePath();
             ctx.stroke();
             ctx.restore();
             
             drawDim(ctx, apexX - dOB/2, apexY + dOH + 10, apexX + dOB/2, apexY + dOH + 10, `ผนังเดิม ${origBase} ม.`, 0, '#666');
        }
        
        drawDim(ctx, x, y+25, x+db, y+25, `ฐานรวมชายคา ${base.toFixed(2)} ม.`, 0, '#333');
        drawDim(ctx, x+db+20, y, x+db+20, y-dh, `สูงรวม ${height.toFixed(2)} ม.`, 0, '#333');

        if (sheetData.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, y); 
            ctx.lineTo(x + db, y); 
            ctx.lineTo(x + db/2, y - dh); 
            ctx.closePath();
            ctx.clip();
            
            sheetData.forEach(sheet => {
                let startRelX = sheet.x;
                if (startRelX > 0 && startRelX < base) {
                    let edgeX = x + startRelX * scale;
                    ctx.beginPath();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 3]);
                    ctx.moveTo(edgeX, y);
                    ctx.lineTo(edgeX, y - dh);
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
                if (endRelX > base) endRelX = base;
                
                let relCenter = (startRelX + endRelX) / 2;
                let centerX = x + relCenter * scale;
                
                let ytCenter;
                if (relCenter <= base/2) {
                    ytCenter = height * (relCenter / (base/2));
                } else {
                    ytCenter = height * ((base - relCenter) / (base/2));
                }
                let yTopCanvas = y - (ytCenter * scale);

                drawVerticalSheetDim(ctx, centerX, y, yTopCanvas, sheet.len.toFixed(2), '#16a34a');

                let labelY = y - 12;
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
