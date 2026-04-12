function analyze() {
  const code = document.getElementById("code").value.trim();

  // Handle empty input FIRST
  if (!code) {
    alert("Please enter an OBD code.");
    return;
  }

  // Show loading state
  const issue = document.getElementById("issue");
  const explanation = document.getElementById("explanation");
  const result = document.getElementById("result");

  issue.textContent = "Analyzing...";
  explanation.textContent = "Checking vehicle data...";
  result.classList.remove("hidden");

  // Call backend
  fetch(`http://localhost:3000/api/code/${code}`)
    .then(res => res.json())
    .then(data => {
      displayResults(data);
    })
    .catch(err => {
      console.error("Backend failed, using mock data");
      useMockData(code);
    });
}

function useMockData(code) {
  const result = document.getElementById("result");
  const issue = document.getElementById("issue");
  const explanation = document.getElementById("explanation");
  const steps = document.getElementById("steps");
  const shops = document.getElementById("shops");

  steps.innerHTML = "";
  shops.innerHTML = "";

  if (code === "P0420") {
    issue.textContent = "Catalytic Converter Efficiency Below Threshold";

    explanation.textContent =
      "Your catalytic converter may not be working properly.";

    ["Check O2 sensor", "Inspect exhaust system", "Visit a mechanic"].forEach(step => {
      let li = document.createElement("li");
      li.textContent = step;
      steps.appendChild(li);
    });

    ["Joe's Auto Repair", "Precision Exhaust Shop"].forEach(shop => {
      let li = document.createElement("li");
      li.textContent = shop;
      shops.appendChild(li);
    });

  } else {
    issue.textContent = "Unknown Code";
    explanation.textContent = "We couldn't find this code.";
  }

  result.classList.remove("hidden");
}

function displayResults(data) {
  const result = document.getElementById("result");
  const issue = document.getElementById("issue");
  const explanation = document.getElementById("explanation");
  const steps = document.getElementById("steps");
  const shops = document.getElementById("shops");

  // Clear old data
  steps.innerHTML = "";
  shops.innerHTML = "";

  // Handle errors from backend
  if (data.error) {
    issue.textContent = data.error;
    explanation.textContent = data.message;
    result.classList.remove("hidden");
    return;
  }

  // Map backend → frontend
  issue.textContent = `${data.code} - ${data.category}`;
  explanation.textContent = data.summary;

  // Generate simple "next steps"
  const defaultSteps = [
    "Inspect related components",
    "Check for sensor issues",
    "Consult a professional mechanic"
  ];

  defaultSteps.forEach(step => {
    let li = document.createElement("li");
    li.textContent = step;
    steps.appendChild(li);
  });

  // Recommended shop
  let li = document.createElement("li");
  li.textContent = data.recommendedShop;
  shops.appendChild(li);

  result.classList.remove("hidden");
}