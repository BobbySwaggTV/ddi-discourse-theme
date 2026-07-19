import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", () => {
	/* v0.2.1 uses template/plugin-outlet layout construction.
	   No runtime DOM injection is used for homepage/sidebar/footer assembly. */
});