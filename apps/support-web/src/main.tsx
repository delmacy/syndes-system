import {createRoot} from "react-dom/client";
import App from "./App.js";
import "./style.css";
const root=document.getElementById("root");
if(!root)throw new Error("Root not found");
createRoot(root).render(<App/>);
