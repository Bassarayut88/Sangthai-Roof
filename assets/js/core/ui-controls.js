// ============================================================
// ระบบควบคุมหน้าจอ: เลือกประเภทหลังคา / รุ่นแผ่น / จุดพิกัดหลายเหลี่ยม
// ============================================================



    function addPoint() {
        let x = parseFloat(document.getElementById('polyX').value);
        let y = parseFloat(document.getElementById('polyY').value);
        
        if (isNaN(x) || isNaN(y)) {
            showWarning("กรุณาระบุค่า X และ Y ให้ถูกต้อง");
            return;
        }
        
        polygonPoints.push({x: x, y: y});
        document.getElementById('polyX').value = '';
        document.getElementById('polyY').value = '';
        document.getElementById('polyX').focus();
        renderPointList();
        if (calcData.calculated && currentMode === 'polygon') calculate();
    }
    
    function removePoint(index) {
        polygonPoints.splice(index, 1);
        renderPointList();
        if (calcData.calculated && currentMode === 'polygon') calculate();
    }
    
    function clearPoints() {
        polygonPoints = [];
        renderPointList();
        if (calcData.calculated && currentMode === 'polygon') calculate();
    }
    
    function renderPointList() {
        const container = document.getElementById('pointListContainer');
        if (polygonPoints.length === 0) {
            container.innerHTML = '<div style="padding:10px; text-align:center; color:#999; font-size:0.9rem;">ยังไม่มีจุดพิกัด</div>';
        } else {
            let html = '';
            polygonPoints.forEach((p, index) => {
                html += `
                    <div class="point-item">
                        <span>${index + 1}. X: <strong>${p.x}</strong>, Y: <strong>${p.y}</strong></span>
                        <button class="btn-small" onclick="removePoint(${index})" style="color:red;">ลบ</button>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        if (typeof redrawPolyEditor === 'function') redrawPolyEditor();
    }

    function toggleRoofType(type) {
        currentMode = type;
        isCurvedMode = (type === 'curve');
        
        let mainContent = document.getElementById('main-content-wrapper');
        let awningWrapper = document.getElementById('awning-wrapper');
        
        if (type === 'awning') {
            if(mainContent) mainContent.style.display = 'none';
            if(awningWrapper) awningWrapper.style.display = 'flex';
            
            let iframe = document.getElementById('awning-iframe');
            if (iframe && !iframe.getAttribute('src')) {
                iframe.src = 'modules/awning.html'; // โหลดโปรแกรมย้ำโค้งจากไฟล์ที่แยกไว้
            }
            
            document.querySelectorAll('.type-option').forEach(el => el.classList.remove('active'));
            let opt = document.getElementById('opt-awning');
            if(opt) opt.classList.add('active');
            return; 
        } else {
            if(mainContent) mainContent.style.display = ''; 
            if(awningWrapper) awningWrapper.style.display = 'none';
        }

        // Update Buttons
        document.querySelectorAll('.type-option').forEach(el => el.classList.remove('active'));
        document.getElementById('opt-' + type).classList.add('active');

        // Reset display
        document.getElementById('inputs-standard').style.display = 'none';
        document.getElementById('inputs-right-tri').style.display = 'none';
        document.getElementById('inputs-triangle').style.display = 'none';
        document.getElementById('inputs-trapezoid').style.display = 'none';
        document.getElementById('inputs-irregular').style.display = 'none';
        document.getElementById('inputs-parallelogram').style.display = 'none';
        document.getElementById('inputs-polygon').style.display = 'none';
        document.getElementById('inputs-louver').style.display = 'none';
        
        document.getElementById('input-angle').style.display = 'block';
        document.getElementById('input-curve-height').style.display = 'none';
        document.getElementById('curve-split-box').style.display = 'none';
        document.getElementById('crimp-curve-box').style.display = 'none';
        document.getElementById('crimpInfoRow').style.display = 'none';
        document.getElementById('curveGableRow').style.display = 'none';
        document.getElementById('cuttingSheetList').style.display = 'none';
        document.getElementById('cuttingFormula').style.display = 'none';
        
        // Hide Results until calculated
        document.getElementById('resultGrid').style.display = 'none';
        document.getElementById('accessoryList').style.display = 'none';
        document.getElementById('priceRow').style.display = 'none';
        
        document.getElementById('input-overhang-container').style.display = 'block';
        document.getElementById('main-profile-group').style.display = 'block';

        if(type === 'slope') {
            document.getElementById('inputs-standard').style.display = 'block';
            document.getElementById('lbl-width').innerText = '2. ความกว้างหน้าอาคาร (ม.)';
            document.getElementById('lbl-run').innerText = '3. ความยาวแนวราบ (Run) (ม.)';
            document.getElementById('roofRun').placeholder = "จั่วถึงปลายเสา";
        } else if (type === 'rightTri') {
            document.getElementById('inputs-right-tri').style.display = 'block';
            document.getElementById('input-overhang-container').style.display = 'none'; 
        } else if (type === 'curve') {
            document.getElementById('inputs-standard').style.display = 'block';
            document.getElementById('input-angle').style.display = 'none';
            document.getElementById('input-curve-height').style.display = 'block';
            document.getElementById('curve-split-box').style.display = 'block';
            document.getElementById('lbl-run').innerText = '3. ความกว้างช่วงเสา (Span) (ม.)';
            document.getElementById('roofRun').placeholder = "ระยะห่างระหว่างเสา";
            setCurveMode('h'); 
        } else if (type === 'crimpCurve') {
            document.getElementById('inputs-standard').style.display = 'block';
            document.getElementById('input-angle').style.display = 'none';
            document.getElementById('input-curve-height').style.display = 'block';
            document.getElementById('curve-split-box').style.display = 'block';
            document.getElementById('crimp-curve-box').style.display = 'block';
            document.getElementById('lbl-run').innerText = '3. ความกว้างช่วงเสา (Span) (ม.)';
            document.getElementById('roofRun').placeholder = "ระยะห่างระหว่างเสา";
            setCurveMode('h');
        } else if (type === 'triangle') {
            document.getElementById('inputs-triangle').style.display = 'block';
        } else if (type === 'trapezoid') {
            document.getElementById('inputs-trapezoid').style.display = 'block';
            document.getElementById('input-overhang-container').style.display = 'none'; 
        } else if (type === 'irregular') {
            document.getElementById('inputs-irregular').style.display = 'block';
            document.getElementById('input-overhang-container').style.display = 'none';
        } else if (type === 'parallelogram') {
            document.getElementById('inputs-parallelogram').style.display = 'block';
            document.getElementById('input-overhang-container').style.display = 'none';
        } else if (type === 'polygon') {
            document.getElementById('inputs-polygon').style.display = 'block';
            document.getElementById('input-overhang-container').style.display = 'none';
            if (typeof initPolyEditor === 'function') initPolyEditor();
        } else if (type === 'louver') {
            document.getElementById('inputs-louver').style.display = 'block';
            document.getElementById('input-overhang-container').style.display = 'none';
            document.getElementById('main-profile-group').style.display = 'none';
            document.getElementById('input-angle').style.display = 'none';
        }
    }

    function setCurveMode(mode) {
        curveCalcMode = mode;
        const input = document.getElementById('curveValue');
        const hint = document.getElementById('curve-hint');
        
        document.getElementById('btn-mode-h').classList.toggle('active', mode === 'h');
        document.getElementById('btn-mode-r').classList.toggle('active', mode === 'r');

        if(mode === 'h') {
            input.placeholder = "ระบุความสูง H (ม.)";
            hint.innerText = "ระบุความสูงจากระดับคานถึงยอดโดม";
        } else {
            input.placeholder = "ระบุรัศมี R (ม.)";
            hint.innerText = "ระบุรัศมีความโค้งที่ต้องการ";
        }
    }

    function updateModelInfo() {
        const select = document.getElementById("sheetProfile");
        const customBox = document.getElementById("customInputBox");
        const purlinBox = document.getElementById("purlinSpacingBox");
        const modelInfo = document.getElementById("modelInfo");
        const val = select.value;

        purlinBox.style.display = "none";

        if (val.startsWith("custom")) {
            customBox.style.display = "block";
            modelInfo.innerText = "";
            document.getElementById("customVal").focus();
        } else {
            customBox.style.display = "none";
            const parts = val.split("|");
            const width = parseFloat(parts[0]);
            const minSlope = parseInt(parts[1]);
            
            const isKL = parts.length > 2 && (parts[2] === "KL" || parts[2] === "CONN");
            
            let slopeText = "";
            if(minSlope > 0) slopeText = ` | แนะนำ Slope ≥ ${minSlope}°`;
            modelInfo.innerText = `✓ หน้ากว้าง: ${width} ม.${slopeText}`;

            if (isKL) {
                purlinBox.style.display = "block";
            }
        }
    }

    function updateLouverInfo() {
        const select = document.getElementById("louverTypeModel");
        const customBox = document.getElementById("customLouverBox");
        const infoBox = document.getElementById("louverModelInfo");
        const val = select.value;

        if (val.startsWith("custom")) {
            customBox.style.display = "block";
            infoBox.innerText = "ระบุจำนวนแผ่นที่ใช้ต่อความสูง 1 เมตร ในช่องด้านล่าง";
            document.getElementById("customLouverDensity").focus();
        } else {
            customBox.style.display = "none";
            const parts = val.split("|");
            const density = parseInt(parts[1]);
            infoBox.innerText = `✓ สูง 1 เมตร จะใช้บานเกล็ด ${density} แผ่น`;
        }
        
        if (calcData.calculated) calculate();
    }

    // --- ทรงโค้ง: สร้างช่องกรอกความยาวแต่ละแผ่น (กรณีซอยแผ่น) ---
    function updateCurvePieceInputs() {
        const piecesEl = document.getElementById('curvePieces');
        let n = parseInt(piecesEl.value) || 1;
        if (n < 1) n = 1;
        if (n > 20) n = 20;
        piecesEl.value = n;

        const custom = document.getElementById('curveCustomLen').checked;
        const box = document.getElementById('curvePieceInputs');
        const hint = document.getElementById('curvePieceHint');

        if (custom && n > 1) {
            let html = '';
            for (let i = 1; i <= n; i++) {
                let prev = document.getElementById('curvePieceLen' + i);
                let val = prev ? prev.value : '';
                let isAuto = prev && prev.dataset.auto === '1';
                html += `<div style="display:flex; align-items:center; gap:6px;">
                    <span style="font-size:0.82rem; color:#1e40af; white-space:nowrap;">แผ่นที่ ${i}</span>
                    <input type="number" id="curvePieceLen${i}" value="${val}" data-auto="${isAuto ? '1' : ''}" step="0.1" min="0" placeholder="อัตโนมัติ" class="${isAuto ? 'curve-piece-auto' : ''}" style="margin:0; padding:8px 10px; font-size:0.9rem;" oninput="this.dataset.auto=''; this.classList.remove('curve-piece-auto'); if(calcData.calculated) calculate();">
                </div>`;
            }
            box.innerHTML = html;
            box.style.display = 'grid';
            box.style.gridTemplateColumns = '1fr 1fr';
            box.style.gap = '6px';
            hint.innerText = '* พิมพ์เฉพาะแผ่นหลักที่ต้องการ ช่องเส้นประจะถูกคำนวณแบ่งให้อัตโนมัติ (ลบค่าออกเพื่อกลับไปเป็นอัตโนมัติ)';
        } else {
            box.style.display = 'none';
            hint.innerText = (n > 1) ? `ระบบจะซอยเท่าๆ กัน ${n} แผ่น (รวมระยะทับซ้อนให้อัตโนมัติ)` : '';
        }

        if (calcData.calculated) calculate();
    }
