"""Langflow component: Molecular Generation Agent."""
from langflow.custom import Component
from langflow.io import DataInput, IntInput, Output
from langflow.schema import Data


class MolecularGenerationComponent(Component):
    display_name = "Molecular Generation Agent"
    description = (
        "Generates drug-like molecular candidates for a given protein target "
        "using RDKit scaffold decoration and Claude AI-designed SMILES."
    )
    icon = "flask-conical"

    inputs = [
        DataInput(
            name="target_data",
            display_name="Target",
            info="Target protein data (Data object from Disease Intelligence Agent)",
        ),
        IntInput(
            name="n_molecules",
            display_name="Molecule Count",
            value=50,
            info="Number of molecules to generate per target",
        ),
    ]

    outputs = [
        Output(display_name="Molecule Library", name="molecule_library", method="build_molecule_library"),
    ]

    async def build_molecule_library(self) -> Data:
        from backend.agents.molecular_generation import MolecularGenerationAgent
        from backend.models.disease import Target

        agent = MolecularGenerationAgent()
        target = Target.model_validate(self.target_data.data)
        library = await agent.generate_candidates(
            target=target,
            n_molecules=self.n_molecules,
        )
        return Data(data=library.model_dump(mode="json"))
