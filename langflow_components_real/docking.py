"""Molecular Docking Agent — Langflow component."""
from langflow.custom import Component
from langflow.io import DataInput, IntInput, Output
from langflow.schema import Data


class DockingComponent(Component):
    display_name = "Molecular Docking Agent"
    description = (
        "Runs molecular docking (DiffDock → AutoDock Vina → mock fallback) "
        "for each molecule against a protein structure. Returns ranked poses."
    )
    icon = "atom"

    inputs = [
        DataInput(
            name="target_data",
            display_name="Target",
            info="Target protein data (Data from Disease Intelligence Agent)",
        ),
        DataInput(
            name="molecule_library",
            display_name="Molecule Library",
            info="Molecule library (Data from Molecular Generation Agent)",
        ),
        IntInput(
            name="top_n",
            display_name="Top N Results",
            value=20,
            info="Number of top-ranked docking results to return",
        ),
    ]

    outputs = [
        Output(display_name="Docking Results", name="docking_results", method="build_docking_results"),
    ]

    async def build_docking_results(self) -> Data:
        from backend.agents.docking import DockingAgent
        from backend.models.disease import Target
        from backend.models.molecule import MoleculeLibrary

        agent = DockingAgent()
        target = Target.model_validate(self.target_data.data)
        library = MoleculeLibrary.model_validate(self.molecule_library.data)
        results = await agent.run_docking(target=target, library=library, top_n=self.top_n)
        return Data(data={
            "target_uniprot_id": target.uniprot_id,
            "results": [r.model_dump(mode="json") for r in results],
        })
