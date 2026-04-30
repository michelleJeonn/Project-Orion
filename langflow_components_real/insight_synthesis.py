"""Insight Synthesis Agent — Langflow component."""
from datetime import datetime

from langflow.custom import Component
from langflow.io import DataInput, MessageTextInput, Output
from langflow.schema import Data


class InsightSynthesisComponent(Component):
    display_name = "Insight Synthesis Agent"
    description = (
        "Synthesizes all pipeline outputs into a CryosisReport: "
        "target insights, Pareto-optimal candidates, safety flags, and executive summary."
    )
    icon = "chart-bar"

    inputs = [
        MessageTextInput(
            name="job_id",
            display_name="Job ID",
            info="Pipeline job identifier (UUID string)",
        ),
        DataInput(
            name="disease_data",
            display_name="Disease Data",
            info="Disease + targets (Data from Disease Intelligence Agent)",
        ),
        DataInput(
            name="libraries_data",
            display_name="Molecule Libraries",
            info='Wrapped libraries: {"libraries": [<MoleculeLibrary dicts>]}',
        ),
        DataInput(
            name="docking_data",
            display_name="Docking Results",
            info='Wrapped docking: {"results_per_target": {uniprot_id: [<DockingResult dicts>]}}',
        ),
        MessageTextInput(
            name="pipeline_start_time",
            display_name="Pipeline Start Time",
            info="ISO-format datetime string (e.g., '2024-01-01T00:00:00')",
        ),
    ]

    outputs = [
        Output(display_name="Final Report", name="report", method="build_report"),
    ]

    async def build_report(self) -> Data:
        from backend.agents.insight_synthesis import InsightSynthesisAgent
        from backend.models.disease import Disease
        from backend.models.molecule import MoleculeLibrary
        from backend.models.report import DockingResult

        agent = InsightSynthesisAgent()
        disease = Disease.model_validate(self.disease_data.data)
        libraries = [MoleculeLibrary.model_validate(lib) for lib in self.libraries_data.data["libraries"]]
        docking_results_per_target = {
            uid: [DockingResult.model_validate(r) for r in results]
            for uid, results in self.docking_data.data["results_per_target"].items()
        }
        report = await agent.synthesize(
            job_id=self.job_id,
            disease=disease,
            libraries=libraries,
            docking_results_per_target=docking_results_per_target,
            pipeline_start_time=datetime.fromisoformat(self.pipeline_start_time),
        )
        return Data(data=report.model_dump(mode="json"))
