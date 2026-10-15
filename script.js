/* =========================================================
   Orbit: a small analytics portal
   1. Data
   2. What the pages remember
   3. Dark mode
   4. Charts
   5. Dashboard page
   6. Customers page (search, filter, sort)
   7. About page
   8. Routing (changing pages)
   ========================================================= */

/* ---------- 1. Data ---------- */
// The data file gives us text in JSON format. JSON.parse turns it into a list we can use.
var customers = JSON.parse(MOCK_JSON);
var months = MOCK_MONTHS;

// Add up each customer's revenue for all months
customers.forEach(function (c) {
  c.total = 0;
  c.revenue.forEach(function (money) { c.total = c.total + money; });
});

var view = document.getElementById('view');

/* ---------- 2. What the pages remember ---------- */
var searchText = '';
var statusFilter = 'All';
var sort1 = { key: 'name', dir: 'asc' };    // the main sort
var sort2 = { key: 'none', dir: 'asc' };    // the second sort, used when the first one is equal
var charts = [];                            // the charts that are on the screen now
var currentPage = showDashboard;            // the page that is on the screen now

/* ---------- 3. Dark mode ---------- */
var themeBtn = document.getElementById('theme-btn');

function setTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  themeBtn.textContent = name === 'dark' ? 'Light mode' : 'Dark mode';
  try { localStorage.setItem('orbit-theme', name); } catch (e) {}

  // Charts take their colours when they are drawn, so draw this page again
  if (charts.length > 0) currentPage();
}

themeBtn.addEventListener('click', function () {
  var now = document.documentElement.getAttribute('data-theme');
  setTheme(now === 'dark' ? 'light' : 'dark');
});

// First visit: use the saved choice, or the device setting
var firstTheme = document.documentElement.getAttribute('data-theme');
if (!firstTheme) {
  var deviceIsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  firstTheme = deviceIsDark ? 'dark' : 'light';
}
document.documentElement.setAttribute('data-theme', firstTheme);
themeBtn.textContent = firstTheme === 'dark' ? 'Light mode' : 'Dark mode';

/* ---------- 4. Charts ---------- */
// Read a colour from style.css, so the charts match the theme
function colour(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function removeCharts() {
  charts.forEach(function (chart) { chart.destroy(); });
  charts = [];
}

// One function draws all three kinds of chart (line, doughnut, bar)
function drawChart(canvasId, type, labels, values) {
  Chart.defaults.color = colour('--muted');
  Chart.defaults.borderColor = colour('--line');

  var colours = [colour('--c1'), colour('--c2'), colour('--c3'), colour('--c4')];
  var dataset = { data: values };

  if (type === 'line') {
    dataset.borderColor = colour('--c1');
    dataset.backgroundColor = colour('--c1') + '33';   // the same colour, mostly see-through
    dataset.fill = true;
    dataset.tension = 0.3;
  } else if (type === 'doughnut') {
    dataset.backgroundColor = colours;
    dataset.borderColor = colour('--card');
  } else {
    dataset.backgroundColor = colour('--c2');
  }

  var chart = new Chart(document.getElementById(canvasId), {
    type: type,
    data: { labels: labels, datasets: [dataset] },
    options: {
      responsive: true,                  // the chart changes size with the screen
      maintainAspectRatio: false,        // and fills the box we gave it in the CSS
      indexAxis: type === 'bar' ? 'y' : 'x',   // bars go sideways, so long country names fit
      plugins: { legend: { display: type === 'doughnut' } }
    }
  });
  if (type !== 'doughnut') {
    chart.options.scales = { y: { beginAtZero: true } };   // start the numbers at zero
    chart.update();
  }
  charts.push(chart);
}

// Count how many customers have each value, for example each plan
function countBy(field) {
  var counts = {};
  customers.forEach(function (c) {
    counts[c[field]] = (counts[c[field]] || 0) + 1;
  });
  return counts;
}

/* ---------- 5. Dashboard page ---------- */
function showDashboard() {
  removeCharts();
  document.title = 'Dashboard | Orbit';

  var active = customers.filter(function (c) { return c.status === 'Active'; }).length;
  var revenue = 0;
  customers.forEach(function (c) { revenue = revenue + c.total; });

  view.innerHTML =
    '<h1>Dashboard</h1>' +
    '<p class="sub">A quick look at our customers (sample data).</p>' +

    '<div class="cards">' +
      '<div class="card"><span>Customers</span><strong>' + customers.length + '</strong></div>' +
      '<div class="card"><span>Active</span><strong>' + active + '</strong></div>' +
      '<div class="card"><span>Revenue</span><strong>$' + revenue.toLocaleString('en-US') + '</strong></div>' +
    '</div>' +

    '<div class="charts">' +
      '<section class="box"><h2>Revenue each month</h2><div class="chart"><canvas id="chart-revenue"></canvas></div></section>' +
      '<section class="box"><h2>Customers by plan</h2><div class="chart"><canvas id="chart-plan"></canvas></div></section>' +
      '<section class="box"><h2>Customers by country</h2><div class="chart"><canvas id="chart-country"></canvas></div></section>' +
    '</div>';

  // Revenue of all customers together, month by month
  var monthTotals = months.map(function (m, i) {
    var sum = 0;
    customers.forEach(function (c) { sum = sum + c.revenue[i]; });
    return sum;
  });
  drawChart('chart-revenue', 'line', months, monthTotals);

  var plans = countBy('plan');
  drawChart('chart-plan', 'doughnut', ['Free', 'Starter', 'Pro', 'Enterprise'],
    [plans.Free || 0, plans.Starter || 0, plans.Pro || 0, plans.Enterprise || 0]);

  var countries = countBy('country');
  drawChart('chart-country', 'bar', Object.keys(countries), Object.keys(countries).map(function (name) { return countries[name]; }));
}

/* ---------- 6. Customers page ---------- */
// Compare two customers by one column. A negative number means "a comes first".
function compare(a, b, key) {
  if (typeof a[key] === 'number') return a[key] - b[key];
  return a[key].localeCompare(b[key]);
}

// Search + filter + sort, all inside the browser
function getRows() {
  var word = searchText.toLowerCase();

  var rows = customers.filter(function (c) {
    var matchesSearch = (c.name + ' ' + c.country).toLowerCase().indexOf(word) !== -1;
    var matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort by two columns: use the second one only when the first one is equal
  rows.sort(function (a, b) {
    var result = compare(a, b, sort1.key);
    if (sort1.dir === 'desc') result = -result;

    if (result === 0 && sort2.key !== 'none') {
      result = compare(a, b, sort2.key);
      if (sort2.dir === 'desc') result = -result;
    }
    return result;
  });
  return rows;
}

function sortOptions(selected, withNone) {
  var list = [['name', 'Name'], ['country', 'Country'], ['plan', 'Plan'], ['status', 'Status'], ['total', 'Revenue']];
  var html = withNone ? '<option value="none">None</option>' : '';
  list.forEach(function (item) {
    html = html + '<option value="' + item[0] + '"' + (item[0] === selected ? ' selected' : '') + '>' + item[1] + '</option>';
  });
  return html;
}

function directionOptions(selected) {
  return '<option value="asc"' + (selected === 'asc' ? ' selected' : '') + '>Low to high (A-Z)</option>' +
         '<option value="desc"' + (selected === 'desc' ? ' selected' : '') + '>High to low (Z-A)</option>';
}

// Draw only the table (so the search box keeps its cursor while typing)
function drawTable() {
  var rows = getRows();
  var html = '';

  if (rows.length === 0) {
    html = '<p class="empty">No customers match your search.</p>';
  } else {
    html = '<div class="table-wrap"><table>' +
      '<thead><tr><th>Name</th><th>Country</th><th>Plan</th><th>Status</th><th class="num">Revenue</th></tr></thead><tbody>';
    rows.forEach(function (c) {
      html = html + '<tr><td>' + c.name + '</td><td>' + c.country + '</td><td>' + c.plan + '</td>' +
        '<td><span class="badge ' + c.status.toLowerCase() + '">' + c.status + '</span></td>' +
        '<td class="num">$' + c.total.toLocaleString('en-US') + '</td></tr>';
    });
    html = html + '</tbody></table></div>';
  }
  document.getElementById('count').textContent = 'Showing ' + rows.length + ' of ' + customers.length + ' customers';
  document.getElementById('table-area').innerHTML = html;
}

function showCustomers() {
  removeCharts();
  document.title = 'Customers | Orbit';

  view.innerHTML =
    '<h1>Customers</h1>' +
    '<p class="sub">Search, filter and sort the list.</p>' +

    '<div class="controls">' +
      '<label>Search <input id="search" type="search" placeholder="Name or country" value="' + searchText + '"></label>' +
      '<label>Status <select id="status">' +
        ['All', 'Active', 'Trial', 'Churned'].map(function (s) {
          return '<option' + (s === statusFilter ? ' selected' : '') + '>' + s + '</option>';
        }).join('') +
      '</select></label>' +
      '<label>Sort by <select id="sort1">' + sortOptions(sort1.key, false) + '</select></label>' +
      '<label>Direction <select id="dir1">' + directionOptions(sort1.dir) + '</select></label>' +
      '<label>Then by <select id="sort2">' + sortOptions(sort2.key, true) + '</select></label>' +
      '<label>Direction <select id="dir2">' + directionOptions(sort2.dir) + '</select></label>' +
    '</div>' +

    '<p id="count" class="sub"></p>' +
    '<div id="table-area"></div>';

  // When any box changes, remember the new value and draw the table again
  document.getElementById('search').addEventListener('input', function (e) { searchText = e.target.value; drawTable(); });
  document.getElementById('status').addEventListener('change', function (e) { statusFilter = e.target.value; drawTable(); });
  document.getElementById('sort1').addEventListener('change', function (e) { sort1.key = e.target.value; drawTable(); });
  document.getElementById('dir1').addEventListener('change', function (e) { sort1.dir = e.target.value; drawTable(); });
  document.getElementById('sort2').addEventListener('change', function (e) { sort2.key = e.target.value; drawTable(); });
  document.getElementById('dir2').addEventListener('change', function (e) { sort2.dir = e.target.value; drawTable(); });

  drawTable();
}

/* ---------- 7. About page ---------- */
function showAbout() {
  removeCharts();
  document.title = 'About | Orbit';

  view.innerHTML =
    '<h1>About Orbit</h1>' +
    '<p class="sub">A small demo portal made for a frontend internship.</p>' +
    '<section class="box">' +
      '<ul>' +
        '<li>All ' + customers.length + ' customers are made up. They are not real people.</li>' +
        '<li>The data is stored as JSON text and read with <code>JSON.parse</code>.</li>' +
        '<li>The graphs are drawn with <strong>Chart.js</strong>.</li>' +
        '<li>The pages are switched by the <strong>Navigo</strong> router, without reloading.</li>' +
        '<li>The theme button switches between light and dark mode and remembers your choice.</li>' +
      '</ul>' +
    '</section>';
}

function showNotFound() {
  removeCharts();
  document.title = 'Not found | Orbit';
  view.innerHTML = '<h1>Page not found</h1><p class="sub">This page does not exist.</p><p><a href="#/">Go to the dashboard</a></p>';
}

/* ---------- 8. Routing ---------- */
var menuLinks = document.querySelectorAll('nav a');

// Show a page and mark its link in the menu
function show(pageName, drawPage) {
  currentPage = drawPage;
  menuLinks.forEach(function (link) {
    if (link.getAttribute('data-page') === pageName) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  drawPage();
  window.scrollTo(0, 0);
}

// Navigo watches the address (the part after #) and runs the matching function
var router = new Navigo('/', { hash: true });

router.on('/', function () { show('dashboard', showDashboard); });
router.on('/customers', function () { show('customers', showCustomers); });
router.on('/about', function () { show('about', showAbout); });
router.notFound(function () { show('', showNotFound); });

// Opening the page with no # at all means the dashboard
if (!window.location.hash) history.replaceState(null, '', '#/');
router.resolve();
