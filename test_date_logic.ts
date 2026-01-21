
function calculateNextDueDate(today: Date, closingDay: number, dueDay: number) {
    let targetMonth = today.getMonth();
    let targetYear = today.getFullYear();

    // If purchase is after closing day, it goes to next month's invoice
    if (today.getDate() > closingDay) {
        targetMonth++;
    }

    // Adjust year if needed
    if (targetMonth > 11) {
        targetMonth = 0;
        targetYear++;
    }

    let dueMonth = targetMonth;
    let dueYear = targetYear;

    if (dueDay < closingDay) {
        dueMonth++;
        if (dueMonth > 11) {
            dueMonth = 0;
            dueYear++;
        }
    }

    return new Date(dueYear, dueMonth, dueDay);
}

// Test Case: Itaú (Closes 14, Due 20). Today is 20/01.
const today = new Date(2026, 0, 20); // 20 Jan 2026
const closingDay = 14;
const dueDay = 20;

const result = calculateNextDueDate(today, closingDay, dueDay);
console.log(`Today: ${today.toISOString().split('T')[0]}`);
console.log(`Card: Closes ${closingDay}, Due ${dueDay}`);
console.log(`Next Due Date: ${result.toISOString().split('T')[0]}`);

if (result.getMonth() === 1 && result.getDate() === 20) {
    console.log('✅ PASS: Vencimento em Fevereiro (correto)');
} else {
    console.log('❌ FAIL: Data incorreta');
}
