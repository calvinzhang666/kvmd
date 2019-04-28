# ========================================================================== #
#                                                                            #
#    KVMD - The main Pi-KVM daemon.                                          #
#                                                                            #
#    Copyright (C) 2018  Maxim Devaev <mdevaev@gmail.com>                    #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
# ========================================================================== #


import importlib
import functools

from typing import Dict
from typing import Type
from typing import Any

from ..yamlconf import Option


# =====
class UnknownPluginError(Exception):
    pass


# =====
class BasePlugin:
    def __init__(self, **_: Any) -> None:
        pass  # pragma: nocover

    @classmethod
    def get_plugin_name(cls) -> str:
        name = cls.__module__
        return name[name.rindex(".") + 1:]

    @classmethod
    def get_plugin_options(cls) -> Dict[str, Option]:
        return {}  # pragma: nocover


@functools.lru_cache()
def get_plugin_class(sub: str, name: str) -> Type[BasePlugin]:
    try:
        module = importlib.import_module("kvmd.plugins.{}.{}".format(sub, name))
    except ModuleNotFoundError:
        raise UnknownPluginError("Unknown plugin '%s/%s'" % (sub, name))
    return getattr(module, "Plugin")
