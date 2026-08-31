// ============================================================
// สถานะกลางของระบบ + ฟังก์ชันหลัก (init / print / canvas)
// ============================================================



    function updateDrawingPrintInfo() {
        let now = new Date();
        let dateStr = now.toLocaleDateString('th-TH') + ' ' + now.toLocaleTimeString('th-TH');
        let elDate = document.getElementById('drawing-print-date');
        if (elDate) elDate.innerText = dateStr;

        let elSub = document.getElementById('drawing-print-sub');
        if (elSub) {
            let typeName = document.getElementById('print-type') ? document.getElementById('print-type').innerText : '';
            let modelName = document.getElementById('print-model') ? document.getElementById('print-model').innerText : '';
            let w = document.getElementById('print-width') ? document.getElementById('print-width').innerText : '';
            let r = document.getElementById('print-run') ? document.getElementById('print-run').innerText : '';
            let count = document.getElementById('outCount') ? document.getElementById('outCount').innerText : '';
            let slope = document.getElementById('print-slope-h') ? document.getElementById('print-slope-h').innerText : '';
            
            let seamInfo = '';
            if (typeof polyStartSeamX === 'number' && !isNaN(polyStartSeamX)) {
                let sideEl = document.getElementById('polyStartSide');
                let sideText = sideEl ? (sideEl.value === 'right' ? 'ขวา → ซ้าย' : 'ซ้าย → ขวา') : '';
                seamInfo = ` | เริ่มมุง: X=${polyStartSeamX.toFixed(2)}ม. (${sideText})`;
            }
            
            elSub.innerText = `ประเภท: ${typeName} | รุ่นแผ่น: ${modelName} | ขนาด: กว้าง ${w} ม. × ยาว/ลึก ${r} ม. | ความชัน: ${slope} | รวม ${count}${seamInfo}`;
        }
    }

    // System print function to handle full quotation print
    function printApp() {
        if (!calcData.calculated) {
            calculate();
        }
        updateDrawingPrintInfo();
        document.body.classList.remove('print-drawing-only');

        if (currentMode === 'awning') {
            let iframe = document.getElementById('awning-iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                    return;
                } catch (err) {
                    // กรณีเปิดแบบ file:// บางเบราว์เซอร์จำกัดการเข้าถึง iframe ข้ามไฟล์
                }
            }
            window.print();
        } else {
            window.print();
        }
    }

    // Print ONLY the Roof Drawing Layout on a standalone A4 sheet
    function printDrawingOnly() {
        if (!calcData.calculated) {
            calculate();
        }
        updateDrawingPrintInfo();
        document.body.classList.add('print-drawing-only');

        window.print();

        setTimeout(() => {
            document.body.classList.remove('print-drawing-only');
        }, 1000);
    }


    let calcData = { calculated: false, profileName: "", length: 0, count: 0, area: 0, screws: 0, flashing: 0, price: 0, angle: 0, isCurve: false };
    let currentMode = 'slope'; // slope, rightTri, curve, triangle, trapezoid, irregular, parallelogram, polygon, awning, louver
    let isCurvedMode = false;
    let curveCalcMode = 'h'; // 'h' for height, 'r' for radius
    let polygonPoints = []; // Stores objects {x: 0, y: 0}
    let polyStartSeamX = null; // พิกัด X ของแนวรอยต่อ/จุดเริ่มมุงแผ่นแรก (เมตร)
    let polyPickStartMode = false; // โหมดคลิกเลือกจุดเริ่มมุงบนภาพ

    function initApp() {
        resizeCanvas();
        toggleRoofType('slope'); // Set default mode correctly
        drawPlaceholder();
        window.addEventListener('resize', () => {
            if(currentMode !== 'awning') {
                resizeCanvas();
                if(calcData.calculated) {
                    calculate(); 
                } else {
                    drawPlaceholder();
                }
            }
        });
        
        // Add Enter key support for polygon inputs
        let polyYInput = document.getElementById("polyY");
        if (polyYInput) {
            polyYInput.addEventListener("keypress", function(event) {
                if (event.key === "Enter") {
                    addPoint();
                }
            });
        }

        // Auto-scale canvas for crisp high-resolution A4 printing
        window.addEventListener('beforeprint', () => {
            updateDrawingPrintInfo();
            const canvas = document.getElementById('roofCanvas');
            if (canvas) {
                canvas.width = 1100;
                canvas.height = 620;
                if (calcData.calculated) {
                    calculate();
                } else {
                    drawPlaceholder();
                }
            }
        });

        window.addEventListener('afterprint', () => {
            document.body.classList.remove('print-drawing-only');
            resizeCanvas();
            if (calcData.calculated) {
                calculate();
            } else {
                drawPlaceholder();
            }
        });
    }

    let cadStudioToastTimer = null;
    function showWarning(msg) {
        const el = document.getElementById('warningMsg');
        if (el) {
            el.innerText = msg;
            el.style.display = 'block';
            setTimeout(() => { el.style.display = 'none'; }, 4500);
        }
        const cadToast = document.getElementById('cadStudioToast');
        if (cadToast) {
            cadToast.innerText = msg;
            cadToast.style.display = 'block';
            cadToast.style.opacity = '1';
            if (cadStudioToastTimer) clearTimeout(cadStudioToastTimer);
            cadStudioToastTimer = setTimeout(() => {
                cadToast.style.opacity = '0';
                setTimeout(() => { cadToast.style.display = 'none'; }, 300);
            }, 4500);
        }
    }

    function resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        const canvas = document.getElementById('roofCanvas');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }

    function drawPlaceholder() {
        if (currentMode === 'louver') {
            drawLouverBox(4, 2, 1, 6, 'none');
        } else {
            drawRoof(4, 5, 1, 5.07, false);
        }
    }
