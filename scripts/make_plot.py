# 1. Create your Plotly figure
import plotly.graph_objects as go

fig = go.Figure(data=go.Scatter(x=[1, 2, 3, 4], y=[10, 11, 12, 13]))
fig.update_layout(title='My Plot')

# 2. Generate the HTML
plot_html = fig.to_html(include_plotlyjs="../static/scripts/plotly-2.35.0.min.js", full_html=False)

# 3. Create a Quartz Markdown file (e.g., plot.md)
quartz_md = f"""
---
permalink: test-plot
title: My Interactive Plot
publish: "true"
---

<div id="plotly-plot"></div>


{plot_html}

"""

# 4. Save the Markdown content to a file
with open('content/plot.html', 'w') as f:
    f.write(quartz_md)