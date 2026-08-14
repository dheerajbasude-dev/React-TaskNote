import React, { useState, useEffect } from 'react';
import './Auth.css';
import { useNavigate } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import { toast } from 'react-toastify';
import { DotPulse } from '@uiball/loaders'; // Import the loader component

const Authcomp = () => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [loading, setLoading] = useState(false); // State for tracking loading state

  const notifyLogin = () => toast.success("Logged in successfully");
  const notifySignup = () => toast.success("Account created successfully");
  const notifyError = () => toast.error("Invalid credentials");
  const notifyErrorPassword = () => toast.error("Password does not match!");

  const toggle = () => {
    setIsSignIn((prevIsSignIn) => !prevIsSignIn);
  };

  useEffect(() => {
    const container = document.getElementById('container');

    const timeoutId = setTimeout(() => {
      container.classList.add('sign-in');
    }, 200);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const container = document.getElementById('container');
    if (isSignIn) {
      container.classList.remove('sign-up');
      container.classList.add('sign-in');
      setPassword("");
      setcPassword("");
    } else {
      container.classList.remove('sign-in');
      container.classList.add('sign-up');
      setlPassword("");
      setlemail("");
      setusername("");
      setemail("");
    }
  }, [isSignIn]);

  const [username, setusername] = useState("");
  const [email, setemail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showcPassword, setShowcPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [cpassword, setcPassword] = useState("");

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const togglecPasswordVisibility = () => {
    setShowcPassword(!showcPassword);
  };

  let navGate = useNavigate();

  const handlesubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Set loading to true when the button is clicked

    if (password === cpassword) {
      const response = await fetch(`${import.meta.env.VITE_API_HOST}/api/auth/createuser`, {
        method: "post",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: username, email: email, password: password })
      });
      const json = await response.json();

      if (json.success) {
        localStorage.setItem("token", json.authtoken);
        notifySignup();
        navGate("/");
      } else {
        notifyError();
      }
    } else {
      notifyErrorPassword();
    }

    setLoading(false); // Set loading back to false after the request is complete
  }

  const [lemail, setlemail] = useState("");
  const [showlPassword, setShowlPassword] = useState(false);
  const [lpassword, setlPassword] = useState("");

  const togglelPasswordVisibility = () => {
    setShowlPassword(!showlPassword);
  };

  const handleLsubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Set loading to true when the button is clicked

    const response = await fetch(`${import.meta.env.VITE_API_HOST}/api/auth/login`, {
      method: "post",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: lemail, password: lpassword })
    });
    const json = await response.json();

    if (json.success) {
      localStorage.setItem("token", json.authtoken);
      localStorage.setItem("email", lemail);
      notifyLogin();
      navGate("/");
    } else {
      notifyError();
    }

    setLoading(false); // Set loading back to false after the request is complete
  }

  return (
    <>
      <div id="container" className="containerAuth">
        <div className="row">
          <div className="col align-items-center flex-col sign-up">
            <div className="form-wrapper align-items-center">
              <div className="form sign-up">
                <form onSubmit={handlesubmit}>
                  <h2>Sign up</h2>
                  <div className="input-group">
                    <i className="fa-solid fa-user" style={{ color: "#bb00ff" }}></i>
                    <input type="text" name="username" value={username} minLength={3} placeholder="Username" onChange={(e) => setusername(e.target.value)} autoComplete="on" required />
                  </div>
                  <div className="input-group">
                    <i className="fa-solid fa-envelope" style={{ color: "#bb00ff" }}></i>
                    <input type="email" name="email" value={email} placeholder="Email" onChange={(e) => setemail(e.target.value)} autoComplete="on" required />
                  </div>
                  <div className="input-group">
                    <i className="fa-solid fa-key" style={{ color: "#bb00ff" }}></i>
                    <input type={showPassword ? "text" : "password"} name="Spassword" value={password} minLength={5} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="on" required />

                    <span className="password-toggle" onClick={togglePasswordVisibility}>
                      {showPassword ? (
                        <i className="fa-solid fa-eye" style={{ color: "#bb00ff" }}></i>
                      ) : (
                        <i className="fa-solid fa-eye-slash" style={{ color: "#bb00ff" }}></i>
                      )}
                    </span>

                  </div>
                  <div className="input-group">
                    <i className="fa-solid fa-key" style={{ color: "#bb00ff" }}></i>
                    <input type={showcPassword ? "text" : "password"} minLength={5} value={cpassword} name="Scpassword" onChange={(e) => setcPassword(e.target.value)} placeholder="Confirm password" autoComplete="on" required />

                    <span className="password-toggle" onClick={togglecPasswordVisibility}>
                      {showcPassword ? (
                        <i className="fa-solid fa-eye" style={{ color: "#bb00ff" }}></i>
                      ) : (
                        <i className="fa-solid fa-eye-slash" style={{ color: "#bb00ff" }}></i>
                      )}
                    </span>

                  </div>
                  {loading ? (
                    <div className="loading-button-container">
                    <button disabled={true} style={{ background: "#dfe1e9" }}>
                      <DotPulse size={40} color="#bb00ff" />
                    </button>
                  </div>
                  ) : (
                    <button>Sign up</button>
                  )}
                  <p>
                    <span> Already have an account? </span>
                    <b className="pointer" onClick={toggle}>Sign in here </b>
                  </p>
                </form>
              </div>
            </div>
          </div>

          <div className="col align-items-center flex-col sign-in">
            <div className="form-wrapper align-items-center">

              <div className="form sign-in">
                <form onSubmit={handleLsubmit}>
                  <h2>Login</h2>
                  <div className="input-group">
                    <i className="fa-solid fa-envelope" style={{ color: "#bb00ff" }}></i>
                    <input type="email" name="Lemail" value={lemail} placeholder="Email" onChange={(e) => setlemail(e.target.value)} autoComplete="on" required />
                  </div>
                  <div className="input-group">
                    <i className="fa-solid fa-key" style={{ color: "#bb00ff" }}></i>
                    <input type={showlPassword ? "text" : "password"} value={lpassword} name="Lpassword" placeholder="Password" minLength={5} onChange={(e) => setlPassword(e.target.value)} autoComplete="on" required />
                    <span className="password-toggle" onClick={togglelPasswordVisibility}>
                      {showlPassword ? (
                        <i className="fa-solid fa-eye" style={{ color: "#bb00ff" }}></i>
                      ) : (
                        <i className="fa-solid fa-eye-slash" style={{ color: "#bb00ff" }}></i>
                      )}
                    </span>

                  </div>
                  {loading ? ( 
                      <div className="loading-button-container">
                      <button disabled={true} style={{ background: "#dfe1e9" }}>
                        <DotPulse size={40} color="#bb00ff" />
                      </button>
                    </div>
                  ) : (
                    <button>Login</button>
                  )}
                  <p>
                    <span> Don't have an account?</span>
                    <b className="pointer" onClick={toggle}> Sign up here</b>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
        <div className="row content-row">
          <div className="col align-items-center flex-col">
            <div className="text sign-in">
              <h2>Welcome to TaskNote</h2>
            </div>
            <div className="img sign-in">
            </div>
          </div>
          <div className="col align-items-center flex-col">
            <div className="img sign-up">

            </div>
            <div className="text sign-up">
              <h2>Join TaskNote</h2>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Authcomp;
