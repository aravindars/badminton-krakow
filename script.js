// --- THE MAIN CALCULATION ENGINE ---
function calculate() {
    // 1. Inputs
    const fullFee = parseFloat(document.getElementById('fullFee').value) || 0;
    const cashPaid = parseFloat(document.getElementById('cashPaid').value) || 0;
    const shuttles = parseFloat(document.getElementById('shuttleCost').value) || 0;
    const hours = parseFloat(document.getElementById('sessionHours').value) || 1;
    const courts = parseInt(document.getElementById('courts').value) || 1; 
    const actualSwipes = parseInt(document.getElementById('actualSwipes').value) || 0;

    const cPlus = parseInt(document.getElementById('cntPlus').value) || 0;
    const cLight = parseInt(document.getElementById('cntLight').value) || 0;
    const cNone = parseInt(document.getElementById('cntNone').value) || 0;
    
    const isCrossDropMode = document.getElementById('modeToggle').checked;
    const totalPlayers = cPlus + cLight + cNone;
    
    if (totalPlayers === 0) return;

    // 2. MultiSport Limits
    const plusMaxDiscount = Math.max(1, Math.floor(hours)) * 15.0; 
    const lightMaxDiscount = 15.0;
    const maxSwipesPerCourtPerHour = 4;
    const totalMaxSlotsAllowed = courts * maxSwipesPerCourtPerHour * hours;
    const minimumStructuralFloor = Math.max(0, fullFee - (totalMaxSlotsAllowed * 15));

    // --- LIVE WARNING SYSTEM (Kept live for immediate input checks) ---
    const expectedPlusSwipes = cPlus * hours;
    const expectedLightSwipes = cLight * 1;
    const theoreticalSwipes = Math.min(expectedPlusSwipes + expectedLightSwipes, totalMaxSlotsAllowed);
    const expectedCashBill = Math.max(0, fullFee - (theoreticalSwipes * 15));
    
    const warningBox = document.getElementById('warningBox');
    const inputDifference = cashPaid - expectedCashBill;
    
    if (warningBox) {
        if (Math.abs(inputDifference) > 0.05) {
            warningBox.style.display = "block";
            document.getElementById('warnExpected').innerText = expectedCashBill.toFixed(2);
            document.getElementById('warnEntered').innerText = cashPaid.toFixed(2);
            document.getElementById('warnDiff').innerText = (inputDifference > 0 ? "+" : "") + inputDifference.toFixed(2);
        } else {
            warningBox.style.display = "none";
        }
    }

    // ==========================================
    // 3. Main Calculation Logic
    // ==========================================
    let finalPlus = 0, finalLight = 0, finalNone = 0;
    const flatShareOfCourt = fullFee / totalPlayers;
    const shuttleShare = shuttles / totalPlayers;

    if (isCrossDropMode) {
        // ENGINE A: ARAVIND'S CROSS DROP
        const isHardCeilingActive = (actualSwipes >= totalMaxSlotsAllowed && minimumStructuralFloor === cashPaid);

        if (isHardCeilingActive) {
            const flatSplit = (cashPaid + shuttles) / totalPlayers;
            finalPlus = finalLight = finalNone = flatSplit;
        } else {
            const baseFloorPerPerson = minimumStructuralFloor / totalPlayers;
            const remainingCourtCashToSplit = Math.max(0, cashPaid - minimumStructuralFloor);
            let courtDebtPlus = 0, courtDebtLight = 0, courtDebtNone = 0;

            if (remainingCourtCashToSplit > 0) {
                const lightDeficit = Math.max(0, plusMaxDiscount - lightMaxDiscount);
                const noneDeficit = plusMaxDiscount;
                const totalDeficitPool = (lightDeficit * cLight) + (noneDeficit * cNone);

                if (totalDeficitPool > 0) {
                    courtDebtLight = (lightDeficit / totalDeficitPool) * remainingCourtCashToSplit;
                    courtDebtNone = (noneDeficit / totalDeficitPool) * remainingCourtCashToSplit;
                } else {
                    courtDebtPlus = courtDebtLight = courtDebtNone = remainingCourtCashToSplit / totalPlayers;
                }
            }
            finalPlus = baseFloorPerPerson + courtDebtPlus + shuttleShare;
            finalLight = baseFloorPerPerson + courtDebtLight + shuttleShare;
            finalNone = baseFloorPerPerson + courtDebtNone + shuttleShare;
        }
        
    } else {
        // ENGINE B: LUDA'S CLEAR
        const lightCardRate = Math.max(0, flatShareOfCourt - Math.min(flatShareOfCourt, lightMaxDiscount));
        const plusCardRate = Math.max(0, flatShareOfCourt - Math.min(flatShareOfCourt, plusMaxDiscount));
        const noCardRate = flatShareOfCourt;

        let totalCourtCashCollected = (noCardRate * cNone) + (lightCardRate * cLight) + (plusCardRate * cPlus);
        
        let finalCourtPlus = plusCardRate;
        let finalCourtLight = lightCardRate;
        let finalCourtNone = noCardRate;

        // UNDERPAYMENT DEFICIT BALANCE
        if (totalCourtCashCollected < cashPaid) {
            const shortFall = cashPaid - totalCourtCashCollected;
            const courtDeficitShare = shortFall / totalPlayers;
            
            finalCourtPlus += courtDeficitShare;
            finalCourtLight += courtDeficitShare;
            finalCourtNone += courtDeficitShare;
            
            totalCourtCashCollected = cashPaid;
        }

        // SURPLUS PROCESSING
        const surplusCash = Math.max(0, totalCourtCashCollected - cashPaid);
        const adjustedShuttlePool = Math.max(0, shuttles - surplusCash);
        const ludaShuttleShare = adjustedShuttlePool / totalPlayers;

        finalPlus = finalCourtPlus + ludaShuttleShare;
        finalLight = finalCourtLight + ludaShuttleShare;
        finalNone = finalCourtNone + ludaShuttleShare;
    }

    // ==========================================
    // 4. Smart Penny Patch Rounding Balance
    // ==========================================
    let roundedPlus = Math.round(finalPlus * 100) / 100;
    let roundedLight = Math.round(finalLight * 100) / 100;
    let roundedNone = Math.round(finalNone * 100) / 100;

    const totalTargetToRecover = cashPaid + shuttles;
    let initialCheckSum = (roundedPlus * cPlus) + (roundedLight * cLight) + (roundedNone * cNone);
    let variance = totalTargetToRecover - initialCheckSum;

    // Distribute remaining pennies safely across available player pools
    if (Math.abs(variance) > 0.001) {
        if (cNone > 0) {
            roundedNone = Math.round((roundedNone + (variance / cNone)) * 100) / 100;
        } else if (cLight > 0) {
            roundedLight = Math.round((roundedLight + (variance / cLight)) * 100) / 100;
        } else if (cPlus > 0) {
            roundedPlus = Math.round((roundedPlus + (variance / cPlus)) * 100) / 100;
        }
    }

    // 5. Print Split Outputs
    document.getElementById('resPlus').innerText = cPlus > 0 ? `${roundedPlus.toFixed(2)} PLN` : "0.00 PLN";
    document.getElementById('resLight').innerText = cLight > 0 ? `${roundedLight.toFixed(2)} PLN` : "0.00 PLN";
    document.getElementById('resNoCard').innerText = cNone > 0 ? `${roundedNone.toFixed(2)} PLN` : "0.00 PLN";

    // 6. Print Validation Message
    const finalVerifiedTotal = (roundedPlus * cPlus) + (roundedLight * cLight) + (roundedNone * cNone);
    const vBox = document.getElementById('validationBox');
    if (vBox) {
        vBox.style.display = "block";
        vBox.className = "validation-box valid-ok";
        vBox.innerText = `✅ Verified: Recovering ${finalVerifiedTotal.toFixed(2)} PLN`;
    }

    // 7. Dynamic Breakdown Copy Generation
    const breakdownContent = document.getElementById('breakdownContent');
    if (breakdownContent) {
        if (isCrossDropMode) {
            const remainingCourtCashToSplit = Math.max(0, cashPaid - minimumStructuralFloor);
            breakdownContent.innerHTML = `
                <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.7; font-size: 13px; color: #334155;">
                    <li>• <strong>Court fee even after max-swipes:</strong> <strong>${minimumStructuralFloor.toFixed(2)}</strong> PLN <span style="color: #64748b; font-size: 11px;">(Split equally by all)</span></li>
                    <li>• <strong>Missing Swipe Balance:</strong> <strong>${remainingCourtCashToSplit.toFixed(2)}</strong> PLN <span style="color: #64748b; font-size: 11px;">(Paid proportionately only by cardless/light users)</span></li>
                    <li>• <strong>Shuttle Cost Pool:</strong> <strong>${shuttles.toFixed(2)}</strong> PLN <span style="color: #64748b; font-size: 11px;">(Split equally by all)</span></li>
                </ul>
                <div style="color: #4338ca; font-weight: bold; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px; font-size: 12px;">
                    💡 Everyone splits the core court fee and shuttles. Only cardless and light users pay proportionately for missing swipes.
                </div>`;
        } else {
            const lightCardRate = Math.max(0, flatShareOfCourt - Math.min(flatShareOfCourt, lightMaxDiscount));
            const plusCardRate = Math.max(0, flatShareOfCourt - Math.min(flatShareOfCourt, plusMaxDiscount));
            const actualLightDiscount = flatShareOfCourt - lightCardRate;
            const actualPlusDiscount = flatShareOfCourt - plusCardRate;
            const totalCourtCashCollected = (flatShareOfCourt * cNone) + (lightCardRate * cLight) + (plusCardRate * cPlus);
            const surplusCash = Math.max(0, totalCourtCashCollected - cashPaid);

            breakdownContent.innerHTML = `
                <ul style="list-style: none; padding: 0; margin: 0; line-height: 1.7; font-size: 13px; color: #334155;">
                    <li>• <strong>Original Court Price:</strong> <strong>${fullFee.toFixed(2)}</strong> PLN</li>
                    <li>• <strong>Standard Court Rates:</strong>
                        <div style="padding-left: 10px; color: #64748b; font-size: 11px;">
                            No-Card User: ${flatShareOfCourt.toFixed(2)} PLN <em>(Flat share)</em><br>
                            Light User: ${lightCardRate.toFixed(2)} PLN <em>(Flat share - ${actualLightDiscount.toFixed(2)})</em><br>
                            Plus User: ${plusCardRate.toFixed(2)} PLN <em>(Flat share - ${actualPlusDiscount.toFixed(2)})</em>
                        </div>
                    </li>
                    <li>• <strong>Shuttle Cost Pool:</strong> <strong>${shuttles.toFixed(2)}</strong> PLN</li>
                    <li>• <strong>Extra cash used to reduce shuttle costs for everyone:</strong> <strong style="color: #10b981;">${surplusCash.toFixed(2)}</strong> PLN</li>
                </ul>
                <div style="color: #4338ca; font-weight: bold; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px; font-size: 12px;">
                    💡 No-card players pay a flat share of the full court price. Extra cash collected reduces the shuttle bill for everyone.
                </div>`;
        }
    }
}

// --- LIVE MAX LABEL TRACKER ---
function updateMaxLabels() {
    const hours = parseFloat(document.getElementById('sessionHours').value) || 1;
    const plusMaxDiscount = Math.max(1, Math.floor(hours)) * 15.0; 
    document.getElementById('plusLabel').innerText = `PLUS (max ${plusMaxDiscount} PLN off court)`;
    document.getElementById('lightLabel').innerText = `LIGHT (max 15.00 PLN off court)`;
}

// 8. Mode Selector Change Hook
document.getElementById('modeToggle').addEventListener('change', function() {
    const title = document.getElementById('modeTitle');
    const sub = document.getElementById('modeSub');
    if (this.checked) {
        title.innerText = "🏸 Mode: Aravind's Cross Drop";
        sub.innerText = "Court fee on top of max-swipes split by all. Missing swipes paid proportionately by no-card and light users.";
    } else {
        title.innerText = "🏸 Mode: Luda's Clear";
        sub.innerText = "Fixed fee for no-card players. Extra money discounts the shuttles.";
    }
    const vBox = document.getElementById('validationBox');
    if (vBox) vBox.style.display = "none";
    
    const breakdownContent = document.getElementById('breakdownContent');
    if (breakdownContent) {
        breakdownContent.innerHTML = `<p style="color:#64748b; font-size:12px; font-style:italic;">Mode changed. Click 'Calculate Fair Split' to generate session information.</p>`;
    }
});

// 9. Attach Calculation Actions
const calcBtn = document.getElementById('calcBtn') || document.querySelector('button');
if (calcBtn) {
    calcBtn.addEventListener('click', function(e) {
        e.preventDefault();
        calculate();
    });
}

document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('input', updateMaxLabels);
});

window.onload = function() {
    updateMaxLabels();
    const vBox = document.getElementById('validationBox');
    if (vBox) vBox.style.display = "none";
};
