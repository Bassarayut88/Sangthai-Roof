// ============================================================
// วาดภาพสามเหลี่ยมมุมฉาก (Right Triangle)
// ============================================================

    function drawRightTriangle(base, height, origBase, origHeight, sheetData) {
        const canvas = document.getElementById('roofCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 50;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        let scaleX = (w - padding*2) / base;
        let scaleY = (h - padding*2) / height;
        let scale = Math.min(scaleX, scaleY);

        let startX = (w - (base * scale)) / 2;
        let bottomY = h - padding - 20;
        
        let cornerX = startX;
        let cornerY = bottomY;
        let topX = startX;
        let topY = bottomY - (height * scale);
        let endX = startX + (base * scale);
        
        ctx.beginPath();
        ctx.moveTo(cornerX, cornerY); 
        ctx.lineTo(cornerX, topY); 
        ctx.lineTo(endX, cornerY); 
        ctx.closePath();
        
        ctx.fillStyle = '#e3f2fd'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#E30613'; ctx.stroke();

        drawDim(ctx, cornerX, cornerY + 20, endX, cornerY + 20, `ฐาน ${base.toFixed(2)} ม.`, 0, '#333');
        drawDim(ctx, cornerX - 20, cornerY, cornerX - 20, topY, `สูง ${height.toFixed(2)} ม.`, 0, '#333');

        if (sheetData && sheetData.length > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cornerX, cornerY); 
            ctx.lineTo(cornerX, topY); 
            ctx.lineTo(endX, cornerY); 
            ctx.closePath();
            ctx.clip();
            
            sheetData.forEach(sheet => {
                let startRelX = sheet.x;
                if (startRelX > 0 && startRelX < base) {
                    let edgeX = startX + startRelX * scale;
                    ctx.beginPath();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 3]);
                    ctx.moveTo(edgeX, cornerY);
                    ctx.lineTo(edgeX, topY); 
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
                let centerX = startX + relCenter * scale;
                
                let ytCenter = height * (1 - (relCenter / base));
                let yTopCanvas = bottomY - (ytCenter * scale);

                drawVerticalSheetDim(ctx, centerX, bottomY, yTopCanvas, sheet.len.toFixed(2), '#16a34a');

                let labelY = bottomY - 12;
                ctx.font = 'bold 11px Sarabun';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 3;
                let textStr = sheet.id.replace('#','');
                ctx.strokeText(textStr, centerX, labelY);
                
                ctx.fillStyle = '#d84315';
                ctx.fillText(textStr, centerX, labelY);
            });
            ctx.restore();
        }
    }
