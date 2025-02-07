// Initialize charts when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Sample data - replace with real data from your backend
    const dailyData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Daily Revenue',
            data: [150, 230, 180, 290, 200, 340, 280],
            borderColor: '#0d6efd',
            tension: 0.4
        }]
    };

    const weeklyData = {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
            label: 'Weekly Revenue',
            data: [1200, 1400, 1100, 1600],
            backgroundColor: '#198754',
            borderRadius: 5
        }]
    };

    const monthlyData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Monthly Revenue',
            data: [5000, 5500, 4800, 6000, 5800, 6500],
            borderColor: '#ffc107',
            fill: true,
            tension: 0.4
        }]
    };

    // Common chart options
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: {
                    color: '#f8f9fa'
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: '#f8f9fa'
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.1)'
                },
                ticks: {
                    color: '#f8f9fa'
                }
            }
        }
    };

    // Create charts
    new Chart(document.getElementById('dailyChart'), {
        type: 'line',
        data: dailyData,
        options: commonOptions
    });

    new Chart(document.getElementById('weeklyChart'), {
        type: 'bar',
        data: weeklyData,
        options: commonOptions
    });

    new Chart(document.getElementById('monthlyChart'), {
        type: 'line',
        data: monthlyData,
        options: commonOptions
    });
});
