document.addEventListener("DOMContentLoaded", function () {
    const authForm = document.getElementById("auth-form");
    const formTitle = document.getElementById("form-title");
    const submitBtn = document.getElementById("submit-btn");
    const toggleLink = document.getElementById("toggle-link");
    const toggleText = document.getElementById("toggle-text");
    const errorMsg = document.getElementById("error-msg");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    let isLogin = true;

    // Check if already logged in
    if (localStorage.getItem("token")) {
        window.location.href = "index.html";
    }

    toggleLink.addEventListener("click", function () {
        isLogin = !isLogin;
        if (isLogin) {
            formTitle.innerText = "Login";
            submitBtn.innerText = "Login";
            toggleText.innerText = "Don't have an account?";
            toggleLink.innerText = "Sign Up";
        } else {
            formTitle.innerText = "Sign Up";
            submitBtn.innerText = "Sign Up";
            toggleText.innerText = "Already have an account?";
            toggleLink.innerText = "Login";
        }
        errorMsg.style.display = "none";
    });

    usernameInput.addEventListener("input", () => {
        errorMsg.style.display = "none";
    });

    passwordInput.addEventListener("input", () => {
        errorMsg.style.display = "none";
    });

    authForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showError("Please fill in all fields.");
            return;
        }

        const endpoint = isLogin ? '/api/login' : '/api/register';
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                if (isLogin) {
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("username", data.username);
                    localStorage.setItem("role", data.role);
                    
                    if (data.role === 'admin') {
                        window.location.href = "admin.html";
                    } else {
                        window.location.href = "index.html";
                    }
                } else {
                    alert("Registration successful! Please login.");
                    isLogin = true;
                    formTitle.innerText = "Login";
                    submitBtn.innerText = "Login";
                    toggleText.innerText = "Don't have an account?";
                    toggleLink.innerText = "Sign Up";
                }
            } else {
                const error = await response.text();
                showError(error);
            }
        } catch (error) {
            showError("Server error. Please try again.");
        }
    });

    function showError(msg) {
        errorMsg.innerText = msg;
        errorMsg.style.display = "block";
    }
});
