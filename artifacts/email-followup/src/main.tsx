import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// @ts-ignore
window.React = React;

createRoot(document.getElementById("root")!).render(<App />);
