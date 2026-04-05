import { Suspense } from "react";
import { BottomBar } from "@/components/panels/BottomBar";
import { HeaderBar } from "@/components/panels/HeaderBar";
import { LeftPanel } from "@/components/panels/LeftPanel";
import { RightPanel } from "@/components/panels/RightPanel";
import { Scene } from "@/components/viewport/Scene";
import { useMapImporter } from "@/hooks/useMapImporter";

export function App(): React.JSX.Element {
	const importer = useMapImporter();

	return (
		<div className="flex h-screen w-screen flex-col bg-[var(--color-bg-primary)]">
			{/* Header */}
			<HeaderBar importer={importer} />

			{/* Main Content */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left Panel */}
				<LeftPanel />

				{/* 3D Viewport Area */}
				<main className="flex-1 bg-[var(--color-bg-primary)]">
					<Suspense
						fallback={
							<div className="flex h-full w-full items-center justify-center">
								<span className="text-sm text-[var(--color-text-secondary)]">
									Loading 3D viewport...
								</span>
							</div>
						}
					>
						<Scene />
					</Suspense>
				</main>

				{/* Right Panel */}
				<RightPanel />
			</div>

			{/* Bottom Bar */}
			<BottomBar />
		</div>
	);
}
