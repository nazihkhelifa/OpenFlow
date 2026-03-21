import os
import sys
import unittest


ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from content_writer import _optimize_operations_pre_validation  # type: ignore


class OperationOptimizerTests(unittest.TestCase):
    def test_reuses_existing_prompt_node(self):
        workflow = {
            "nodes": [
                {"id": "prompt-existing", "type": "prompt", "data": {"prompt": "old"}},
                {"id": "img-1", "type": "generateImage", "data": {}},
            ],
            "edges": [],
        }
        ops = [
            {
                "type": "addNode",
                "nodeType": "prompt",
                "nodeId": "prompt-new",
                "data": {"prompt": "new prompt"},
            },
            {
                "type": "addEdge",
                "source": "prompt-new",
                "target": "img-1",
                "sourceHandle": "text",
                "targetHandle": "text",
            },
        ]
        optimized = _optimize_operations_pre_validation(ops, workflow, ["prompt-existing"])
        self.assertEqual(optimized[0]["type"], "updateNode")
        self.assertEqual(optimized[0]["nodeId"], "prompt-existing")
        self.assertEqual(optimized[1]["type"], "addEdge")
        self.assertEqual(optimized[1]["source"], "prompt-existing")

    def test_dedupes_duplicate_edges(self):
        workflow = {"nodes": [], "edges": []}
        ops = [
            {"type": "addEdge", "source": "a", "target": "b", "sourceHandle": "text", "targetHandle": "text"},
            {"type": "addEdge", "source": "a", "target": "b", "sourceHandle": "text", "targetHandle": "text"},
        ]
        optimized = _optimize_operations_pre_validation(ops, workflow, [])
        self.assertEqual(len(optimized), 1)


if __name__ == "__main__":
    unittest.main()

