// ============================================================
// วาดภาพบานเกล็ด (Louver)
// ============================================================

    // --- วาดบานเกล็ด (Louver) ---
    function drawLouverBox(width, height, spacing, rows, flashingType = 'none') {
        const canvas = document.getElementById('roofCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const padding = 60;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        drawGrid(ctx, w, h);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        let scaleX = (w - padding * 2) / width;
        let scaleY = (h - padding * 2) / height;
        let scale = Math.min(scaleX, scaleY);

        let drawW = width * scale;
        let drawH = height * scale;
        
        let startX = (w - drawW) / 2;
        let startY = (h - drawH) / 2;

        // กรอบช่องเปิด
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(startX, startY, drawW, drawH);
        
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.strokeRect(startX, startY, drawW, drawH);

        // เสาแนวตั้ง (ขารับ)
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        let posts = Math.ceil(width / spacing);
        for (let i = 1; i <= posts; i++) {
            let px = startX + (i * spacing * scale);
            if (px < startX + drawW - 1) {
                ctx.beginPath();
                ctx.moveTo(px, startY);
                ctx.lineTo(px, startY + drawH);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);

        // แผ่นบานเกล็ดแนวนอน
        ctx.strokeStyle = '#1e40af'; 
        ctx.lineWidth = 2;
        
        let maxVisualRows = 40; 
        let drawRows = Math.min(rows, maxVisualRows);
        let rowSpacingY = drawH / rows;

        for (let r = 0; r < drawRows; r++) {
            let y = startY + (r * rowSpacingY) + (rowSpacingY / 2);
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(startX + drawW, y);
            ctx.stroke();
        }

        if (rows > maxVisualRows) {
            ctx.fillStyle = '#1e40af';
            ctx.font = 'bold 14px Sarabun';
            ctx.textAlign = 'center';
            ctx.fillText(`... และอีก ${rows - maxVisualRows} แถว ...`, w/2, startY + drawH - 10);
        }

        // แผ่นครอบ (Flashing)
        if (flashingType !== 'none') {
            ctx.strokeStyle = 'rgba(249, 115, 22, 0.8)'; // สีส้ม
            
            if (flashingType === 'perimeter' || flashingType === 'both') {
                ctx.lineWidth = 6;
                ctx.strokeRect(startX, startY, drawW, drawH);
            }
            
            if (flashingType === 'vertical' || flashingType === 'both') {
                ctx.lineWidth = 6;
                for (let i = 0; i <= posts; i++) {
                    let px = startX + (i * spacing * scale);
                    if (px > startX + drawW) px = startX + drawW;
                    
                    ctx.beginPath();
                    ctx.moveTo(px, startY);
                    ctx.lineTo(px, startY + drawH);
                    ctx.stroke();
                }
            }
        }

        drawDim(ctx, startX, startY + drawH, startX + drawW, startY + drawH, `กว้าง ${width.toFixed(2)} ม.`, 30);
        drawDim(ctx, startX, startY, startX, startY + drawH, `สูง ${height.toFixed(2)} ม.`, 30);
        
        if (width >= spacing && spacing > 0) {
            let firstPostX = startX + (spacing * scale);
            drawDim(ctx, startX, startY, firstPostX, startY, `@${spacing.toFixed(2)}`, -20, '#d84315');
        }

        ctx.fillStyle = '#E30613'; 
        ctx.font = 'bold 14px Sarabun';
        ctx.textAlign = 'left';
        ctx.fillText(`ภาพตัดขวางจำลอง (จำนวน ${rows} แถว)`, startX, startY - 35);
    }
