import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", (api) => {
	function runInterfaceRender() {
		console.log("DDI Command Network interface loaded");
	}

	api.onPageChange(() => {
		runInterfaceRender();
	});
});