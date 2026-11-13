"use client";
import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
const config = defineConfig({ theme: { tokens: { fonts: { body: { value: ""IBM Plex Sans", Inter, ui-sans-serif, system-ui, sans-serif" }, heading: { value: ""IBM Plex Sans", Inter, ui-sans-serif, system-ui, sans-serif" } } } } });
const system = createSystem(defaultConfig, config);
export default function Providers({children}) { return <ChakraProvider value={system}>{children}</ChakraProvider>; }
