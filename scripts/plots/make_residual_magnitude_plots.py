import pandas as pd
from dash import Dash, dcc, html, dash_table
import plotly.express as px
import plotly.graph_objects as go
import numpy as np

df = pd.read_csv('scripts/plots/fig2.csv')

# from https://colab.research.google.com/drive/1Z6AgGpPpnGY43DT58vl_Wvqmyw-KRfqY?usp=sharing#scrollTo=865d29bf
def line_plot(
    df: pd.DataFrame,
    log_y: bool = True,
    title: str = "Residual Stream Norm by Layer Number",
    color: str = "Prompt",
    legend_title_text: str = "Prompt",
) -> go.Figure:
    """Make a line plot of the RichPrompt norm. If log_y is True,
    adds a column to the dataframe with the log10 of the norm."""
    for col in ["Prompt", "Activation Location", "Magnitude"]:
        assert col in df.columns, f"Column {col} not in dataframe"

    if log_y:
        df["LogMagnitude"] = np.log10(df["Magnitude"])

    fig = px.line(
        df,
        x="Activation Location",
        y="LogMagnitude" if log_y else "Magnitude",
        color=color,
        color_discrete_sequence=px.colors.sequential.Rainbow[::-1],
    )

    fig.update_layout(
        legend_title_text=legend_title_text,
        title=title,
        xaxis_title="Layer Number",
        yaxis_title=f"Norm{' (log 10)' if log_y else ''}",
    )
    return fig

model_name = "gpt2-xl"
figs:list[go.Figure] = []
for use_log in (True, False):
    fig = line_plot(
        df,
        log_y=use_log,
        title=f"Residual Stream Norm by Layer Number in {model_name}",
        color="Token",
        legend_title_text="Token"
    )
    fig.update_layout(width=600, height=450)
    figs.append(fig)

for i, fig in enumerate(figs):
    with open(f'content/plots/residual_magnitude_{i+1}.html', 'x') as f:
        fig.write_html(file=f, include_plotlyjs='/static/scripts/plotly.min.js', div_id=f'plot{i}', full_html=False)