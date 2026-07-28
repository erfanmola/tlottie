import { render } from "solid-js/web";
import { App } from "./App.tsx";

const root = document.getElementById("app");
if (root) render(() => <App />, root);
